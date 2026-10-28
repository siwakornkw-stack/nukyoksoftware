param([string]$Dir, [string]$PlanFile, [string]$Ledger)
# Writes an approved PK's H3 into the R3 (ตั้งหนี้บัตรเครดิต) of its bill date in
# an Express company folder, the way the office keeps them: lines added to the
# day's unpaid R3 (its totals and its two journal lines raised), or a new R3.
# Must run in 32-bit PowerShell: the VFP OLE DB provider is 32-bit only. The
# plan comes from scripts/express/r3.mjs.
#
# The provider has no TRY/CATCH, THROW, macros or file functions, and a failing
# command aborts its script half way. So every step is its own small EXECSCRIPT
# on one connection (the open tables, locks and data session persist between
# them); each appended record and each changed field (with its old value) goes
# to the ledger before the next step, and any failure deletes the appended rows
# and puts the changed fields back. Tables are opened with INDEX: Express's
# tables have no structural-CDX flag, so that is the only way their indexes stay
# in step. Thai text only travels as parameters, never as literals in the
# scripts. Keep this file UTF-8 with BOM (PowerShell 5.1 reads it in the ANSI
# page otherwise, and some Thai letters then end a string).
#
# Prints one line: RESULT:OK:<docnum> | RESULT:EXISTS:<docnum> | RESULT:BUSY:<why> | RESULT:ERR:<message>
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$inv = [Globalization.CultureInfo]::InvariantCulture
$plan = [IO.File]::ReadAllText($PlanFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$state = [ordered]@{ pk = $plan.pkNo; mode = $plan.mode; dir = $Dir; started = (Get-Date).ToString("s"); status = "writing"; docNo = ""; added = @(); changed = @() }
function Save-Ledger { [IO.File]::WriteAllText($Ledger, ($state | ConvertTo-Json -Depth 6), [Text.Encoding]::UTF8) }

$cn = New-Object System.Data.OleDb.OleDbConnection("Provider=VFPOLEDB.1;Data Source=$Dir;Collating Sequence=MACHINE;")
function Run([string]$body, [object[]]$params = @()) {
  $names = (1..[Math]::Max(1, $params.Count) | ForEach-Object { "p$_" }) -join ", "
  $c = $cn.CreateCommand()
  $c.CommandText = "EXECSCRIPT(" + ((0..[Math]::Max(1, $params.Count) | ForEach-Object { "?" }) -join ", ") + ")"
  [void]$c.Parameters.AddWithValue("s", "LPARAMETERS " + $names + "`r`n" + $body)
  if ($params.Count -eq 0) { [void]$c.Parameters.AddWithValue("x", "") }
  $i = 0; foreach ($v in $params) { [void]$c.Parameters.AddWithValue("v$i", [string]$v); $i++ }
  return [string]$c.ExecuteScalar()
}
# VFP date from a "YYYYMMDD" parameter.
function D([string]$p) { "DATE(VAL(LEFT($p, 4)), VAL(SUBSTR($p, 5, 2)), VAL(RIGHT($p, 2)))" }
function N2([double]$n) { $n.ToString("F2", $inv) }

# Append one record; its record number goes to the ledger at once.
function Append([string]$alias, [string]$assign, [object[]]$params) {
  $r = Run ("SELECT $alias`r`nAPPEND BLANK`r`nREPLACE $assign IN $alias`r`nRETURN TRANSFORM(RECNO('$alias'))") $params
  $state.added += , @($alias, [int]$r); Save-Ledger
  return [int]$r
}
# Change one field of one record; the old value goes to the ledger first.
# $expr is the new value, written with p4… for $params (p1 recno, p2 alias, p3 field).
function Change([string]$alias, [int]$recno, [string]$field, [string]$expr, [object[]]$params = @()) {
  $old = Run "GO VAL(p1) IN (p2)`r`nLOCAL t, v`r`nt = TYPE(p2 + '.' + p3)`r`nv = EVALUATE(p2 + '.' + p3)`r`nRETURN t + '|' + ICASE(t `$ 'NBYIF', STR(v, 25, 10), t = 'D', DTOS(v), t = 'L', IIF(v, 'T', 'F'), v)" @($recno, $alias, $field)
  $state.changed += , [ordered]@{ alias = $alias; recno = $recno; field = $field; old = $old }; Save-Ledger
  [void](Run ("GO VAL(p1) IN (p2)`r`nREPLACE (p3) WITH $expr IN (p2)`r`nRETURN 'ok'") (@($recno, $alias, $field) + $params))
}
# One fuel line of the R3: item 2120-03, the vehicle and its H3 as description.
function Add-Line([string]$doc, [int]$seq, $l) {
  [void](Append "r3st" ("stkcod WITH p3, loccod WITH '-', docnum WITH p2, seqnum WITH PADL(p4, 3), docdat WITH $(D 'p1'), posopr WITH '0', people WITH p5, " +
    "trnqty WITH 1, tqucod WITH p6, tfactor WITH 1, unitpr WITH VAL(p8), trnval WITH VAL(p8), xtrnqty WITH 1, xunitpr WITH VAL(p8), xtrnval WITH VAL(p8), " +
    "xsalval WITH VAL(p8), netval WITH VAL(p8), stkdes WITH p7") @($date, $doc, $plan.item, $seq, $plan.supCode, $plan.unit, $l.desc, (N2 ([double]$l.amount))))
}

$total = 0.0; foreach ($l in $plan.lines) { $total += [double]$l.amount }
$total = N2 ([Math]::Round($total, 2))
$date = ([string]$plan.date) -replace "-", ""
$result = ""
$tables = @(@("aptrn", "r3ap"), @("stcrd", "r3st"), @("gljnl", "r3gj"), @("gljnlit", "r3gi"), @("apmas", "r3am"), @("apbal", "r3ab"))

try {
  $cn.Open()
  Save-Ledger
  # Open everything with its index; wait up to 5 s on a lock held by an Express user.
  $open = "SET DELETED OFF`r`nSET EXACT OFF`r`nSET MULTILOCKS ON`r`nSET REPROCESS TO 5 SECONDS`r`n"
  foreach ($t in $tables) { $open += "USE $($t[0]) INDEX $($t[0]) SHARED IN 0 ALIAS $($t[1])`r`n" }
  [void](Run ($open + "RETURN 'ok'"))

  # Written per PK until 2026-10-28 (the PK number in REFNUM, "เลขที่บิล")?
  $own = Run "SELECT r3ap`r`nLOCATE FOR rectyp = '3' AND LEFT(docnum, 2) == 'R3' AND ALLTRIM(refnum) == ALLTRIM(p1) AND docstat # 'C' AND NOT DELETED()`r`nRETURN IIF(FOUND(), ALLTRIM(r3ap.docnum), '')" @($plan.pkNo)
  if ($own) { $state.status = "exists"; $state.docNo = $own; Save-Ledger; $result = "EXISTS:$own"; return }
  # The plan's H3s already on an R3 line ("... /<H3>")? All of them: done. Some: a person looks.
  $onR3 = @()
  foreach ($h in $plan.h3) {
    $doc = Run ("LOCAL c`r`nc = ''`r`nSELECT r3st`r`nSCAN FOR LEFT(docnum, 2) == 'R3' AND RIGHT(STRTRAN(ALLTRIM(stkdes), ' ', ''), LEN(p1) + 1) == '/' + p1 AND NOT DELETED()`r`n" +
      "SELECT r3ap`r`nLOCATE FOR docnum == r3st.docnum AND rectyp = '3' AND docstat # 'C' AND NOT DELETED()`r`nIF FOUND()`r`nc = ALLTRIM(r3st.docnum)`r`nENDIF`r`n" +
      "SELECT r3st`r`nIF NOT EMPTY(c)`r`nEXIT`r`nENDIF`r`nENDSCAN`r`nRETURN c") @($h)
    if ($doc) { $onR3 += $doc }
  }
  if ($onR3.Count -eq @($plan.h3).Count) { $state.status = "exists"; $state.docNo = $onR3[0]; Save-Ledger; $result = "EXISTS:$($onR3[0])"; return }
  if ($onR3.Count -gt 0) { throw "H3 บางใบของ $($plan.pkNo) อยู่ใน R3 แล้ว ($($onR3 -join ', ')) ต้องตรวจใน Express" }

  # Lock the creditor's two balance rows before writing anything.
  $mas = Run "SELECT r3am`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('r3am'), TRANSFORM(RECNO('r3am')), 'LOCKED')" @($plan.supCode)
  $bal = Run "SELECT r3ab`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('r3ab'), TRANSFORM(RECNO('r3ab')), 'LOCKED')" @($plan.supCode)
  if ($mas -eq "LOCKED" -or $bal -eq "LOCKED") { $state.status = "busy"; Save-Ledger; $result = "BUSY:มีคนกำลังแก้ข้อมูลผู้จำหน่าย $($plan.supCode) ใน Express"; return }
  if ($mas -eq "NOTFOUND" -or $bal -eq "NOTFOUND") { throw "ไม่พบผู้จำหน่าย $($plan.supCode) ใน APMAS/APBAL" }

  if ($plan.mode -eq "append") {
    # The day's R3, still as planned: unpaid, its journal the usual two lines.
    $hd = Run ("SELECT r3ap`r`nLOCATE FOR docnum == PADR(p1, LEN(docnum)) AND rectyp = '3' AND docstat # 'C' AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`n" +
      "IF NOT RLOCK('r3ap')`r`nRETURN 'LOCKED'`r`nENDIF`r`n" +
      "RETURN TRANSFORM(RECNO('r3ap')) + '|' + STR(r3ap.payamt, 15, 2) + '|' + STR(r3ap.remamt, 15, 2) + '|' + STR(r3ap.netamt, 15, 2) + '|' + ALLTRIM(r3ap.nxtseq) + '|' + DTOS(r3ap.docdat)") @($plan.docNo)
    if ($hd -eq "LOCKED") { $state.status = "busy"; Save-Ledger; $result = "BUSY:มีคนกำลังแก้ $($plan.docNo) ใน Express"; return }
    if ($hd -eq "NOTFOUND") { throw "ไม่พบ $($plan.docNo) ใน Express" }
    $h = $hd.Split("|")
    $rec = [int]$h[0]
    if ($h[1].Trim() -ne "0.00" -or $h[2].Trim() -ne $h[3].Trim()) {
      # Paid since it was planned: next run plans again (a new R3 for the day).
      $state.status = "busy"; Save-Ledger; $result = "BUSY:$($plan.docNo) มีการจ่ายแล้ว ระบบจะวางแผนใหม่ในรอบถัดไป"; return
    }
    if ($h[5] -ne $date) { throw "$($plan.docNo) ไม่ได้ลงวันที่ $($plan.date)" }
    $gl = Run ("LOCAL n, d, c`r`nn = 0`r`nd = 0`r`nc = 0`r`nSELECT r3gi`r`nSCAN FOR voucher == PADR(p1, LEN(voucher)) AND NOT DELETED()`r`nn = n + 1`r`n" +
      "IF accnum == PADR(p2, LEN(accnum)) AND trntyp == '0'`r`nd = RECNO()`r`nENDIF`r`nIF accnum == PADR(p3, LEN(accnum)) AND trntyp == '1'`r`nc = RECNO()`r`nENDIF`r`nENDSCAN`r`n" +
      "RETURN TRANSFORM(n) + '|' + TRANSFORM(d) + '|' + TRANSFORM(c)") @($plan.docNo, $plan.drAcc, $plan.crAcc)
    $g = $gl.Split("|")
    if ($g[0] -ne "2" -or $g[1] -eq "0" -or $g[2] -eq "0") { throw "สมุดรายวันของ $($plan.docNo) ไม่ใช่แบบปกติ (Dr $($plan.drAcc) / Cr $($plan.crAcc)) ต้องเพิ่มบรรทัดใน Express เอง" }
    $locked = Run "GO VAL(p1) IN r3gi`r`nIF NOT RLOCK('r3gi')`r`nRETURN 'LOCKED'`r`nENDIF`r`nGO VAL(p2) IN r3gi`r`nRETURN IIF(RLOCK('r3gi'), 'ok', 'LOCKED')" @($g[1], $g[2])
    if ($locked -ne "ok") { $state.status = "busy"; Save-Ledger; $result = "BUSY:มีคนกำลังแก้ $($plan.docNo) ใน Express"; return }
    $doc = [string]$plan.docNo
    $state.docNo = $doc; Save-Ledger

    # Lines after the R3's last one, then its totals and its two journal lines.
    $seq = [int]$h[4]
    foreach ($l in $plan.lines) { $seq++; Add-Line $doc $seq $l }
    foreach ($f in @("amount", "aftdisc", "total", "netamt", "netval", "remamt")) { Change "r3ap" $rec $f "r3ap.$f + VAL(p4)" @($total) }
    Change "r3ap" $rec "nxtseq" "PADL(p4, 3)" @($seq)
    Change "r3ap" $rec "chgdat" "DATE()"
    Change "r3gi" ([int]$g[1]) "amount" "r3gi.amount + VAL(p4)" @($total)
    Change "r3gi" ([int]$g[2]) "amount" "r3gi.amount + VAL(p4)" @($total)
  } else {
    # Next free R3YYMMDD-NN (deleted rows count too: numbers are never reused).
    $doc = Run "LOCAL n`r`nn = 0`r`nSELECT r3ap`r`nSCAN FOR LEFT(docnum, LEN(p1)) == p1`r`nn = MAX(n, VAL(SUBSTR(docnum, LEN(p1) + 1, 2)))`r`nENDSCAN`r`nRETURN IIF(n >= 99, '', p1 + PADL(TRANSFORM(n + 1), 2, '0'))" @($plan.prefix)
    if (-not $doc) { throw "เลขที่ R3 ของวันนี้เต็ม (99)" }
    $state.docNo = $doc; Save-Ledger

    $seq = 0
    foreach ($l in $plan.lines) { $seq++; Add-Line $doc $seq $l }
    # Journal 04: header, then Dr item account / Cr creditor account.
    [void](Append "r3gj" ("jnltyp WITH '04', voudat WITH $(D 'p1'), voucher WITH p2, descrp WITH p3, trnstat WITH 'P', docstat WITH 'N', " +
      "creby WITH p4, credat WITH DATE(), userid WITH p4, chgdat WITH DATE()") @($date, $doc, $plan.glDescr, $plan.user))
    $time = (Get-Date).ToString("HHmm")
    foreach ($side in @(@(" 0", $plan.drAcc, "0"), @(" 6", $plan.crAcc, "1"))) {
      [void](Append "r3gi" ("voucher WITH p2, seqit WITH p3, voudat WITH $(D 'p1'), accnum WITH p4, descrp WITH p5, trntyp WITH p6, " +
        "amount WITH VAL(p7), chgdat WITH DATE(), chgtim WITH p8") @($date, $doc, $side[0], $side[1], $plan.glDescr, $side[2], $total, $time))
    }
    # Header (APTRN). No PK in REFNUM: a day's R3 carries many bills, each line its H3.
    [void](Append "r3ap" ("rectyp WITH '3', docnum WITH p2, docdat WITH $(D 'p1'), vatprd WITH DATE(YEAR($(D 'p1')), MONTH($(D 'p1')), 1), " +
      "flgvat WITH '0', supcod WITH p3, youref WITH p4, paytrm WITH 0, duedat WITH $(D 'p1'), bilnum WITH '~', " +
      "nxtseq WITH PADL(p5, 3), amount WITH VAL(p6), aftdisc WITH VAL(p6), total WITH VAL(p6), vatrat WITH 7, netamt WITH VAL(p6), " +
      "netval WITH VAL(p6), remamt WITH VAL(p6), cmplapp WITH 'N', docstat WITH 'N', vatdat WITH $(D 'p1'), srv_vattyp WITH '1', " +
      "pvatprorat WITH '-', userid WITH p7, chgdat WITH DATE(), orgnum WITH 0") @($date, $doc, $plan.supCode, $plan.youref, $seq, $total, $plan.user))
    # The number must be unique (someone keying an R3 at the same moment).
    $n = Run "LOCAL n`r`nSELECT r3ap`r`nCOUNT FOR docnum == PADR(p1, LEN(docnum)) AND NOT DELETED() TO n`r`nRETURN TRANSFORM(n)" @($doc)
    if ($n -ne "1") { throw "เลขที่ $doc ซ้ำ ($n ใบ)" }
  }

  # Creditor balance + last receive date, then the period purchases (APBAL).
  Change "r3am" ([int]$mas) "balance" "r3am.balance + VAL(p4)" @($total)
  Change "r3am" ([int]$mas) "lasrcv" "IIF(EMPTY(r3am.lasrcv) OR r3am.lasrcv < $(D 'p4'), $(D 'p4'), r3am.lasrcv)" @($date)
  # Test hook (never set in normal runs): fail with everything but APBAL written,
  # to prove the rollback undoes rows, totals and balances.
  if ($env:R3_TEST_FAIL_AT -eq "before-apbal") { [void](Run "USE r3_test_no_such_table IN 0`r`nRETURN 'x'") }
  Change "r3ab" ([int]$bal) ([string]$plan.balColumn) "EVALUATE('r3ab.' + p3) + VAL(p4)" @($total)

  $state.status = "done"; Save-Ledger
  $result = "OK:$doc"
} catch {
  $err = $_.Exception.Message
  try {
    if ($cn.State -eq "Open") {
      $added = @($state.added); [array]::Reverse($added)
      foreach ($a in $added) { [void](Run "GO VAL(p2) IN (p1)`r`nDELETE IN (p1)`r`nRETURN 'ok'" @($a[0], $a[1])) }
      $changed = @($state.changed); [array]::Reverse($changed)
      foreach ($c in $changed) {
        $t = $c.old.Substring(0, 1); $v = $c.old.Substring(2)
        $expr = switch ($t) { "D" { "IIF(EMPTY(p4), {}, $(D 'p4'))" } "L" { "p4 == 'T'" } "C" { "p4" } default { "VAL(p4)" } }
        [void](Run ("GO VAL(p1) IN (p2)`r`nREPLACE (p3) WITH $expr IN (p2)`r`nRETURN 'ok'") @($c.recno, $c.alias, $c.field, $v))
      }
      $state.status = "rolled-back"
    } else { $state.status = "failed-unopened" }
  } catch {
    $state.status = "ROLLBACK-FAILED"
    $err = "$err | ย้อนกลับไม่สำเร็จ: $($_.Exception.Message)"
  }
  $state.error = $err; Save-Ledger
  $result = "ERR:$err"
} finally {
  if ($cn.State -eq "Open") {
    $close = "UNLOCK ALL`r`n"
    foreach ($t in $tables) { $close += "IF USED('$($t[1])')`r`nUSE IN $($t[1])`r`nENDIF`r`n" }
    try { [void](Run ($close + "RETURN 'ok'")) } catch {}
    $cn.Close()
  }
  "RESULT:" + $result
}
