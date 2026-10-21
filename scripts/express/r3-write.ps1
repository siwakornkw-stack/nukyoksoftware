param([string]$Dir, [string]$PlanFile, [string]$Ledger)
# Writes one R3 (ตั้งหนี้บัตรเครดิต) into an Express company folder, the way
# Express records one keyed by hand. Must run in 32-bit PowerShell: the VFP OLE
# DB provider is 32-bit only. The plan comes from scripts/express/r3.mjs.
#
# The provider has no TRY/CATCH, THROW, macros or file functions, and a failing
# command aborts its script half way. So every step is its own small EXECSCRIPT
# on one connection (the open tables, locks and data session persist between
# them), each new record number goes to the ledger file before the next step,
# and any failure deletes the rows written so far and reverses the balances.
# Tables are opened with INDEX: Express's tables have no structural-CDX flag, so
# that is the only way their indexes stay in step. Thai text only travels as
# parameters, never as literals in the scripts.
#
# Prints one line: RESULT:OK:<docnum> | RESULT:EXISTS:<docnum> | RESULT:BUSY:<why> | RESULT:ERR:<message>
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$inv = [Globalization.CultureInfo]::InvariantCulture
$plan = [IO.File]::ReadAllText($PlanFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$state = [ordered]@{ pk = $plan.pkNo; dir = $Dir; started = (Get-Date).ToString("s"); status = "writing"; docNo = ""; added = @(); mas = $null; bal = $null }
function Save-Ledger { [IO.File]::WriteAllText($Ledger, ($state | ConvertTo-Json -Depth 5), [Text.Encoding]::UTF8) }

$cn = New-Object System.Data.OleDb.OleDbConnection("Provider=VFPOLEDB.1;Data Source=$Dir;Collating Sequence=MACHINE;")
function Run([string]$body, [object[]]$params = @()) {
  $names = (1..[Math]::Max(1, $params.Count) | ForEach-Object { "p$_" }) -join ", "
  $prog = "LPARAMETERS " + $names + "`r`n" + $body
  $c = $cn.CreateCommand()
  $c.CommandText = "EXECSCRIPT(" + ((0..[Math]::Max(1, $params.Count) | ForEach-Object { "?" }) -join ", ") + ")"
  [void]$c.Parameters.AddWithValue("s", $prog)
  if ($params.Count -eq 0) { [void]$c.Parameters.AddWithValue("x", "") }
  $i = 0; foreach ($v in $params) { [void]$c.Parameters.AddWithValue("v$i", [string]$v); $i++ }
  return [string]$c.ExecuteScalar()
}
function Num([double]$n) { $n.ToString("F2", $inv) }
function Added([string]$alias, [string]$recno) { $state.added += ,@($alias, [int]$recno); Save-Ledger }

$total = 0.0; foreach ($l in $plan.lines) { $total += [double]$l.amount }
$total = [Math]::Round($total, 2)
$date = ([string]$plan.date) -replace "-", ""
# VFP date from a "YYYYMMDD" parameter.
function D([string]$p) { "DATE(VAL(LEFT($p, 4)), VAL(SUBSTR($p, 5, 2)), VAL(RIGHT($p, 2)))" }
$result = ""

try {
  $cn.Open()
  Save-Ledger
  # Open everything with its index; wait up to 5 s on a lock held by an Express user.
  [void](Run ("SET DELETED OFF`r`nSET EXACT OFF`r`nSET REPROCESS TO 5 SECONDS`r`n" +
    "USE aptrn INDEX aptrn SHARED IN 0 ALIAS r3ap`r`nUSE stcrd INDEX stcrd SHARED IN 0 ALIAS r3st`r`n" +
    "USE gljnl INDEX gljnl SHARED IN 0 ALIAS r3gj`r`nUSE gljnlit INDEX gljnlit SHARED IN 0 ALIAS r3gi`r`n" +
    "USE apmas INDEX apmas SHARED IN 0 ALIAS r3am`r`nUSE apbal INDEX apbal SHARED IN 0 ALIAS r3ab`r`nRETURN 'ok'"))

  # Already written for this PK? (The PK number is kept in REFNUM, "เลขที่บิล".)
  $exists = Run "SELECT r3ap`r`nLOCATE FOR rectyp = '3' AND LEFT(docnum, 2) == 'R3' AND ALLTRIM(refnum) == ALLTRIM(p1) AND docstat # 'C' AND NOT DELETED()`r`nRETURN IIF(FOUND(), ALLTRIM(r3ap.docnum), '')" @($plan.pkNo)
  if ($exists) { $state.status = "exists"; $state.docNo = $exists; Save-Ledger; $result = "EXISTS:$exists"; return }

  # Lock the creditor's two balance rows before writing anything.
  $mas = Run "SELECT r3am`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nIF NOT RLOCK('r3am')`r`nRETURN 'LOCKED'`r`nENDIF`r`nRETURN TRANSFORM(RECNO('r3am')) + '|' + DTOS(r3am.lasrcv) + '|' + STR(r3am.balance, 25, 10)" @($plan.supCode)
  $bal = Run "SELECT r3ab`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nIF NOT RLOCK('r3ab')`r`nRETURN 'LOCKED'`r`nENDIF`r`nRETURN TRANSFORM(RECNO('r3ab')) + '|' + STR(EVALUATE('r3ab.' + p2), 25, 10)" @($plan.supCode, $plan.balColumn)
  if ($mas -eq "LOCKED" -or $bal -eq "LOCKED") { $state.status = "busy"; Save-Ledger; $result = "BUSY:มีคนกำลังแก้ข้อมูลผู้จำหน่าย $($plan.supCode) ใน Express"; return }
  if ($mas -eq "NOTFOUND" -or $bal -eq "NOTFOUND") { throw "ไม่พบผู้จำหน่าย $($plan.supCode) ใน APMAS/APBAL" }
  $m = $mas.Split("|"); $b = $bal.Split("|")
  $state.mas = [ordered]@{ recno = [int]$m[0]; oldLasrcv = $m[1]; oldBalance = $m[2].Trim(); done = $false }
  $state.bal = [ordered]@{ recno = [int]$b[0]; column = $plan.balColumn; old = $b[1].Trim(); done = $false }
  Save-Ledger

  # Next free R3YYMMDD-NN (deleted rows count too: numbers are never reused).
  $doc = Run "LOCAL n`r`nn = 0`r`nSELECT r3ap`r`nSCAN FOR LEFT(docnum, LEN(p1)) == p1`r`nn = MAX(n, VAL(SUBSTR(docnum, LEN(p1) + 1, 2)))`r`nENDSCAN`r`nRETURN IIF(n >= 99, '', p1 + PADL(TRANSFORM(n + 1), 2, '0'))" @($plan.prefix)
  if (-not $doc) { throw "เลขที่ R3 ของวันนี้เต็ม (99)" }
  $state.docNo = $doc; Save-Ledger

  # Lines: one STCRD row per fuel line, item 2120-03, description = vehicle.
  $seq = 0
  foreach ($l in $plan.lines) {
    $seq++
    $r = Run ("SELECT r3st`r`nAPPEND BLANK`r`nREPLACE stkcod WITH p3, loccod WITH '-', docnum WITH p2, seqnum WITH PADL(p4, 3), docdat WITH $(D "p1"), " +
      "posopr WITH '0', people WITH p5, trnqty WITH 1, tqucod WITH p6, tfactor WITH 1, unitpr WITH VAL(p8), trnval WITH VAL(p8), " +
      "xtrnqty WITH 1, xunitpr WITH VAL(p8), xtrnval WITH VAL(p8), xsalval WITH VAL(p8), netval WITH VAL(p8), stkdes WITH p7 IN r3st`r`n" +
      "RETURN TRANSFORM(RECNO('r3st'))") @($date, $doc, $plan.item, $seq, $plan.supCode, $plan.unit, $l.desc, (Num ([double]$l.amount)))
    Added "r3st" $r
  }

  # Journal 04: header, then Dr item account / Cr creditor account.
  $r = Run ("SELECT r3gj`r`nAPPEND BLANK`r`nREPLACE jnltyp WITH '04', voudat WITH $(D "p1"), voucher WITH p2, descrp WITH p3, trnstat WITH 'P', docstat WITH 'N', " +
    "creby WITH p4, credat WITH DATE(), userid WITH p4, chgdat WITH DATE() IN r3gj`r`nRETURN TRANSFORM(RECNO('r3gj'))") @($date, $doc, $plan.glDescr, $plan.user)
  Added "r3gj" $r
  foreach ($side in @(@(" 0", $plan.drAcc, "0"), @(" 6", $plan.crAcc, "1"))) {
    $r = Run ("SELECT r3gi`r`nAPPEND BLANK`r`nREPLACE voucher WITH p2, seqit WITH p3, voudat WITH $(D "p1"), accnum WITH p4, descrp WITH p5, trntyp WITH p6, " +
      "amount WITH VAL(p7), chgdat WITH DATE(), chgtim WITH p8 IN r3gi`r`nRETURN TRANSFORM(RECNO('r3gi'))") @($date, $doc, $side[0], $side[1], $plan.glDescr, $side[2], (Num $total), (Get-Date).ToString("HHmm"))
    Added "r3gi" $r
  }

  # Header (APTRN), PK number in REFNUM.
  $r = Run ("SELECT r3ap`r`nAPPEND BLANK`r`nREPLACE rectyp WITH '3', docnum WITH p2, docdat WITH $(D "p1"), vatprd WITH DATE(YEAR($(D "p1")), MONTH($(D "p1")), 1), " +
    "refnum WITH p3, flgvat WITH '0', supcod WITH p4, youref WITH p5, paytrm WITH 0, duedat WITH $(D "p1"), bilnum WITH '~', " +
    "nxtseq WITH PADL(p6, 3), amount WITH VAL(p7), aftdisc WITH VAL(p7), total WITH VAL(p7), vatrat WITH 7, netamt WITH VAL(p7), " +
    "netval WITH VAL(p7), remamt WITH VAL(p7), cmplapp WITH 'N', docstat WITH 'N', vatdat WITH $(D "p1"), srv_vattyp WITH '1', " +
    "pvatprorat WITH '-', userid WITH p8, chgdat WITH DATE(), orgnum WITH 0 IN r3ap`r`nRETURN TRANSFORM(RECNO('r3ap'))") @($date, $doc, $plan.pkNo, $plan.supCode, $plan.youref, $plan.lines.Count, (Num $total), $plan.user)
  Added "r3ap" $r

  # The number must be unique (someone keying an R3 at the same moment).
  $n = Run "LOCAL n`r`nSELECT r3ap`r`nCOUNT FOR docnum == PADR(p1, LEN(docnum)) AND NOT DELETED() TO n`r`nRETURN TRANSFORM(n)" @($doc)
  if ($n -ne "1") { throw "เลขที่ $doc ซ้ำ ($n ใบ)" }

  # Creditor balance + last receive date, then the period purchases (APBAL).
  [void](Run "GO VAL(p1) IN r3am`r`nREPLACE balance WITH balance + VAL(p2), lasrcv WITH IIF(EMPTY(lasrcv) OR lasrcv < $(D "p3"), $(D "p3"), lasrcv) IN r3am`r`nRETURN 'ok'" @($state.mas.recno, (Num $total), $date))
  $state.mas.done = $true; Save-Ledger
  # Test hook (never set in normal runs): fail after everything but APBAL is written,
  # to prove the rollback undoes rows and the creditor balance.
  if ($env:R3_TEST_FAIL_AT -eq "before-apbal") { [void](Run "USE r3_test_no_such_table IN 0`r`nRETURN 'x'") }
  [void](Run "GO VAL(p1) IN r3ab`r`nREPLACE (p2) WITH EVALUATE('r3ab.' + p2) + VAL(p3) IN r3ab`r`nRETURN 'ok'" @($state.bal.recno, $plan.balColumn, (Num $total)))
  $state.bal.done = $true

  $state.status = "done"; Save-Ledger
  $result = "OK:$doc"
} catch {
  $err = $_.Exception.Message
  $undo = @()
  try {
    if ($cn.State -eq "Open") {
      foreach ($a in $state.added) { [void](Run "GO VAL(p2) IN (p1)`r`nDELETE IN (p1)`r`nRETURN 'ok'" @($a[0], $a[1])); $undo += "$($a[0])#$($a[1])" }
      if ($state.mas -and $state.mas.done) {
        [void](Run "GO VAL(p1) IN r3am`r`nREPLACE balance WITH VAL(p2), lasrcv WITH IIF(EMPTY(p3), {}, $(D "p3")) IN r3am`r`nRETURN 'ok'" @($state.mas.recno, $state.mas.oldBalance, $state.mas.oldLasrcv))
      }
      if ($state.bal -and $state.bal.done) {
        [void](Run "GO VAL(p1) IN r3ab`r`nREPLACE (p2) WITH VAL(p3) IN r3ab`r`nRETURN 'ok'" @($state.bal.recno, $state.bal.column, $state.bal.old))
      }
      $state.status = "rolled-back"
    } else { $state.status = "failed-unopened" }
  } catch {
    $state.status = "ROLLBACK-FAILED"
    $err = "$err | ย้อนกลับไม่สำเร็จ: $($_.Exception.Message)"
  }
  $state.error = $err; $state.undone = $undo; Save-Ledger
  $result = "ERR:$err"
} finally {
  if ($cn.State -eq "Open") {
    try { [void](Run "UNLOCK ALL`r`nIF USED('r3ap')`r`nUSE IN r3ap`r`nENDIF`r`nIF USED('r3st')`r`nUSE IN r3st`r`nENDIF`r`nIF USED('r3gj')`r`nUSE IN r3gj`r`nENDIF`r`nIF USED('r3gi')`r`nUSE IN r3gi`r`nENDIF`r`nIF USED('r3am')`r`nUSE IN r3am`r`nENDIF`r`nIF USED('r3ab')`r`nUSE IN r3ab`r`nENDIF`r`nRETURN 'ok'") } catch {}
    $cn.Close()
  }
  "RESULT:" + $result
}
