param([string]$Dir, [string]$PlanFile, [string]$Ledger)
# Writes the PK (+ H3) for one fuel bill into an Express company folder, the way
# staff key them. 32-bit PowerShell only (VFP OLE DB provider). Plan: fuel.mjs.
#
# Same rules as r3-write.ps1: every table opened with INDEX (no structural-CDX
# flag), one small EXECSCRIPT per step on one connection, Thai text only as
# parameters, each appended record and each changed field (with its old value)
# logged to the ledger before the next step, and on any failure the appended
# records are deleted and the changed fields put back.
#
# Prints one line: RESULT:OK:<pk>|<h3> | RESULT:EXISTS:<pk>|<h3> | RESULT:BUSY:<why> | RESULT:ERR:<message>
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$inv = [Globalization.CultureInfo]::InvariantCulture
$plan = [IO.File]::ReadAllText($PlanFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$state = [ordered]@{ order = $plan.orderId; invoice = $plan.invoice; dir = $Dir; started = (Get-Date).ToString("s"); status = "writing"; pkNo = ""; h3No = ""; added = @(); changed = @() }
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
function N4([double]$n) { $n.ToString("F4", $inv) }

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

$date = ([string]$plan.date) -replace "-", ""
$result = ""
$tables = @(@("popr", "fwpo"), @("poprit", "fwpi"), @("isrun", "fwrn"), @("stmas", "fwsm"), @("aptrn", "fwap"), @("stcrd", "fwst"),
  @("gljnl", "fwgj"), @("gljnlit", "fwgi"), @("isvat", "fwvt"), @("aprcpcq", "fwpc"), @("apbal", "fwab"), @("apmas", "fwam"))

try {
  $cn.Open()
  Save-Ledger
  $open = "SET DELETED OFF`r`nSET EXACT OFF`r`nSET REPROCESS TO 5 SECONDS`r`n"
  foreach ($t in $tables) { $open += "USE $($t[0]) INDEX $($t[0]) SHARED IN 0 ALIAS $($t[1])`r`n" }
  [void](Run ($open + "RETURN 'ok'"))

  # Already in Express? (staff may have keyed this bill, perhaps under another
  # branch's supplier code, then with the same amount; or an earlier run wrote it)
  $h3 = Run ("SELECT fwap`r`nLOCATE FOR LEFT(docnum, 2) == 'H3' AND ALLTRIM(refnum) == ALLTRIM(p2) AND docstat # 'C' AND NOT DELETED() AND " +
    "(supcod == PADR(p1, LEN(supcod)) OR ROUND(netamt, 2) = ROUND(VAL(p3), 2))`r`nRETURN IIF(FOUND(), ALLTRIM(fwap.docnum) + '|' + ALLTRIM(fwap.ponum), '')") @($plan.supplier.code, $plan.invoice, (N2 $plan.total))
  if ($h3) { $p = $h3.Split("|"); $state.status = "exists"; $state.h3No = $p[0]; $state.pkNo = $p[1]; Save-Ledger; $result = "EXISTS:$($p[1])|$($p[0])"; return }
  $pkNo = [string]$plan.pkNo
  $pkRec = 0
  if ($pkNo) {
    $pkRec = [int](Run "SELECT fwpo`r`nLOCATE FOR ponum == PADR(p1, LEN(ponum)) AND NOT DELETED()`r`nRETURN IIF(FOUND(), TRANSFORM(RECNO('fwpo')), '0')" @($pkNo))
    if (-not $pkRec) { throw "ไม่พบ $pkNo ใน POPR" }
  } else {
    $pkFound = Run "SELECT fwpo`r`nLOCATE FOR LEFT(ponum, 2) == 'PK' AND supcod == PADR(p1, LEN(supcod)) AND podat = $(D 'p2') AND ALLTRIM(youref) == ALLTRIM(p3) AND docstat # 'C' AND NOT DELETED()`r`nRETURN IIF(FOUND(), ALLTRIM(fwpo.ponum) + '|' + TRANSFORM(RECNO('fwpo')), '')" @($plan.supplier.code, $date, $plan.invoice)
    if ($pkFound) { $p = $pkFound.Split("|"); $pkNo = $p[0]; $pkRec = [int]$p[1] }
  }
  if ($pkNo -and -not $plan.withH3) { $state.status = "exists"; $state.pkNo = $pkNo; Save-Ledger; $result = "EXISTS:$pkNo|"; return }

  # Lock every existing row this write changes before writing anything.
  $item = Run "SELECT fwsm`r`nLOCATE FOR stkcod == PADR(p1, LEN(stkcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('fwsm'), TRANSFORM(RECNO('fwsm')), 'LOCKED')" @($plan.item.code)
  if ($item -eq "NOTFOUND") { throw "ไม่พบรหัสรถ $($plan.item.code) ใน STMAS" }
  $run = "0"
  if (-not $pkNo) {
    $run = Run "SELECT fwrn`r`nLOCATE FOR doctyp == 'PO' AND prefix == 'PK' AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('fwrn'), TRANSFORM(RECNO('fwrn')), 'LOCKED')"
    if ($run -eq "NOTFOUND") { throw "ไม่พบเลขรันของ PK ใน ISRUN" }
  }
  $mas = "0"; $bal = "0"
  if ($plan.withH3) {
    $mas = Run "SELECT fwam`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('fwam'), TRANSFORM(RECNO('fwam')), 'LOCKED')" @($plan.supplier.code)
    $bal = Run "SELECT fwab`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('fwab'), TRANSFORM(RECNO('fwab')), 'LOCKED')" @($plan.supplier.code)
    if ($mas -eq "NOTFOUND" -or $bal -eq "NOTFOUND") { throw "ไม่พบผู้จำหน่าย $($plan.supplier.code) ใน APMAS/APBAL" }
  }
  if ($item -eq "LOCKED" -or $run -eq "LOCKED" -or $mas -eq "LOCKED" -or $bal -eq "LOCKED") {
    $state.status = "busy"; Save-Ledger; $result = "BUSY:มีคนกำลังแก้ข้อมูลที่ต้องใช้ใน Express (รหัสรถ / เลขรัน PK / ผู้จำหน่าย)"; return
  }

  # ---- PK ----
  if (-not $pkNo) {
    # Next number from ISRUN ("0000002   "), skipping any already in POPR.
    $pkNo = Run "LOCAL n, c`r`nGO VAL(p1) IN fwrn`r`nn = VAL(ALLTRIM(fwrn.docnum))`r`nSELECT fwpo`r`nDO WHILE .T.`r`nc = 'PK' + PADL(TRANSFORM(n), 7, '0')`r`nLOCATE FOR ponum == PADR(c, LEN(ponum))`r`nIF NOT FOUND()`r`nEXIT`r`nENDIF`r`nn = n + 1`r`nENDDO`r`nRETURN c" @($run)
    $state.pkNo = $pkNo; Save-Ledger
    $pkRec = Append "fwpo" ("porectyp WITH '0', ponum WITH p2, podat WITH $(D 'p1'), flgvat WITH '1', depcod WITH p3, supcod WITH p4, paytrm WITH 0, " +
      "rcvdat WITH $(D 'p1'), nxtseq WITH '  1', amount WITH VAL(p5), total WITH VAL(p5), vatrat WITH 7, vatamt WITH VAL(p6), netamt WITH VAL(p5), " +
      "netval WITH VAL(p7), docstat WITH 'N', userid WITH p8, chgdat WITH DATE(), orgnum WITH VAL(p9), youref WITH p10") @(
      $date, $pkNo, $plan.dep, $plan.supplier.code, (N2 $plan.total), (N2 $plan.vat), (N2 $plan.net), $plan.user, [string]$plan.supplier.branch, $plan.invoice)
    [void](Append "fwpi" ("porectyp WITH '0', ponum WITH p2, seqnum WITH '  1', rcvdat WITH $(D 'p1'), supcod WITH p3, stkcod WITH p4, loccod WITH '-', " +
      "stkdes WITH p5, depcod WITH p6, ordqty WITH VAL(p7), remqty WITH VAL(p7), tfactor WITH 1, unitpr WITH VAL(p8), tqucod WITH p9, " +
      "disc WITH IIF(VAL(p10) = 0, '', PADL(p10, 10)), discamt WITH VAL(p10), trnval WITH VAL(p11)") @(
      $date, $pkNo, $plan.supplier.code, $plan.item.code, $plan.item.desc, $plan.dep, (N2 $plan.qty), (N4 $plan.price), $plan.item.unit, (N2 $plan.disc), (N2 $plan.total)))
    $n = Run "LOCAL n`r`nSELECT fwpo`r`nCOUNT FOR ponum == PADR(p1, LEN(ponum)) AND NOT DELETED() TO n`r`nRETURN TRANSFORM(n)" @($pkNo)
    if ($n -ne "1") { throw "เลขที่ $pkNo ซ้ำ ($n ใบ)" }
    Change "fwrn" ([int]$run) "docnum" "PADR(PADL(TRANSFORM(VAL(SUBSTR(p4, 3)) + 1), 7, '0'), LEN(fwrn.docnum))" @($pkNo)
    Change "fwsm" ([int]$item) "totreo" "fwsm.totreo + VAL(p4)" @((N2 $plan.qty))
  }

  # ---- H3 ----
  if ($plan.withH3) {
    $h3No = Run "LOCAL n`r`nn = 0`r`nSELECT fwap`r`nSCAN FOR LEFT(docnum, LEN(p1)) == p1`r`nn = MAX(n, VAL(SUBSTR(docnum, LEN(p1) + 1, 2)))`r`nENDSCAN`r`nRETURN IIF(n >= 99, '', p1 + PADL(TRANSFORM(n + 1), 2, '0'))" @($plan.h3Prefix)
    if (-not $h3No) { throw "เลขที่ H3 ของวันนี้เต็ม (99)" }
    $state.h3No = $h3No; Save-Ledger
    $piRec = [int](Run "SELECT fwpi`r`nLOCATE FOR ponum == PADR(p1, LEN(ponum)) AND seqnum == '  1' AND NOT DELETED()`r`nRETURN IIF(FOUND(), TRANSFORM(RECNO('fwpi')), '0')" @($pkNo))
    if (-not $piRec) { throw "ไม่พบรายการของ $pkNo ใน POPRIT" }

    [void](Append "fwst" ("stkcod WITH p3, loccod WITH '-', docnum WITH p2, seqnum WITH '  1', docdat WITH $(D 'p1'), rdocnum WITH PADR(p4, 12) + '  1', " +
      "refnum WITH p5, depcod WITH p6, posopr WITH '0', people WITH p7, trnqty WITH VAL(p8), tqucod WITH p9, tfactor WITH 1, unitpr WITH VAL(p10), " +
      "disc WITH IIF(VAL(p11) = 0, '', PADL(p11, 10)), discamt WITH VAL(p11), trnval WITH VAL(p12), xtrnqty WITH VAL(p8), xunitpr WITH VAL(p13), " +
      "xtrnval WITH VAL(p14), xsalval WITH VAL(p14), netval WITH VAL(p14), stkdes WITH p15") @(
      $date, $h3No, $plan.item.code, $pkNo, $plan.invoice, $plan.dep, $plan.supplier.code, (N2 $plan.qty), $plan.item.unit, (N4 $plan.price),
      (N2 $plan.disc), (N2 $plan.total), (N4 $plan.xunit), (N2 $plan.net), $plan.item.desc))
    [void](Append "fwgj" ("jnltyp WITH '03', voudat WITH $(D 'p1'), voucher WITH p2, descrp WITH p3, trnstat WITH 'P', docstat WITH 'N', " +
      "creby WITH p4, credat WITH DATE(), userid WITH p4, chgdat WITH DATE()") @($date, $h3No, $plan.glDescr, $plan.user))
    $time = (Get-Date).ToString("HHmm")
    foreach ($g in @(@(" 2", $plan.accounts.expense, $plan.dep, "0", $plan.net), @(" 3", $plan.accounts.vat, $plan.dep, "0", $plan.vat), @(" 6", $plan.accounts.pay, "", "1", $plan.total))) {
      [void](Append "fwgi" ("voucher WITH p2, seqit WITH p3, voudat WITH $(D 'p1'), accnum WITH p4, depcod WITH p5, descrp WITH p6, trntyp WITH p7, " +
        "amount WITH VAL(p8), chgdat WITH DATE(), chgtim WITH p9") @($date, $h3No, $g[0], $g[1], $g[2], $plan.glDescr, $g[3], (N2 ([double]$g[4])), $time))
    }
    [void](Append "fwvt" ("vatrec WITH 'P', rectyp WITH '1', vatprd WITH DATE(YEAR($(D 'p1')), MONTH($(D 'p1')), 1), vatdat WITH $(D 'p1'), docdat WITH $(D 'p1'), " +
      "docnum WITH p2, refnum WITH p3, depcod WITH p4, descrp WITH p5, amt01 WITH VAL(p6), vat01 WITH VAL(p7), self_added WITH 'N', had_modify WITH 'N', " +
      "docstat WITH 'N', taxid WITH p8, orgnum WITH VAL(p9), prenam WITH p10") @(
      $date, $h3No, $plan.invoice, $plan.dep, $plan.supplier.name, (N2 $plan.net), (N2 $plan.vat), $plan.supplier.taxId, [string]$plan.supplier.branch, $plan.supplier.prenam))
    [void](Append "fwpc" "rcpnum WITH p1, chqnum WITH LEFT('PJ' + p1, 12), payamt WITH VAL(p2)" @($h3No, (N2 $plan.total)))
    [void](Append "fwap" ("rectyp WITH '1', docnum WITH p2, docdat WITH $(D 'p1'), refnum WITH p3, vatprd WITH DATE(YEAR($(D 'p1')), MONTH($(D 'p1')), 1), " +
      "ponum WITH p4, depcod WITH p5, flgvat WITH '1', supcod WITH p6, paytrm WITH 0, duedat WITH $(D 'p1'), bilnum WITH '~', nxtseq WITH '  1', " +
      "amount WITH VAL(p7), aftdisc WITH VAL(p7), advnum WITH 'AE', total WITH VAL(p7), vatrat WITH 7, vatamt WITH VAL(p8), netamt WITH VAL(p7), " +
      "netval WITH VAL(p9), payamt WITH VAL(p7), cmplapp WITH 'Y', cmpldat WITH $(D 'p1'), docstat WITH 'N', chqpay WITH VAL(p7), rcvamt WITH VAL(p7), " +
      "chqpas WITH VAL(p7), vatdat WITH $(D 'p1'), srv_vattyp WITH '1', pvatprorat WITH '-', userid WITH p10, chgdat WITH DATE(), orgnum WITH VAL(p11)") @(
      $date, $h3No, $plan.invoice, $pkNo, $plan.dep, $plan.supplier.code, (N2 $plan.total), (N2 $plan.vat), (N2 $plan.net), $plan.user, [string]$plan.supplier.branch))
    $n = Run "LOCAL n`r`nSELECT fwap`r`nCOUNT FOR docnum == PADR(p1, LEN(docnum)) AND NOT DELETED() TO n`r`nRETURN TRANSFORM(n)" @($h3No)
    if ($n -ne "1") { throw "เลขที่ $h3No ซ้ำ ($n ใบ)" }

    # The PK is now fully received; supplier and item totals follow.
    Change "fwpo" $pkRec "docstat" "'M'"
    Change "fwpo" $pkRec "cmpldat" (D "p4") @($date)
    Change "fwpi" $piRec "remqty" "0"
    Change "fwsm" ([int]$item) "totreo" "fwsm.totreo - VAL(p4)" @((N2 $plan.qty))
    Change "fwam" ([int]$mas) "lasrcv" "IIF(EMPTY(fwam.lasrcv) OR fwam.lasrcv < $(D 'p4'), $(D 'p4'), fwam.lasrcv)" @($date)
    # Test hook (never set in normal runs): fail with everything but APBAL written,
    # to prove the rollback restores text, date and number fields.
    if ($env:FUEL_TEST_FAIL_AT -eq "before-apbal") { [void](Run "USE fuel_test_no_such_table IN 0`r`nRETURN 'x'") }
    Change "fwab" ([int]$bal) ([string]$plan.hpColumn) "EVALUATE('fwab.' + p3) + VAL(p4)" @((N2 $plan.total))
  }

  $state.status = "done"; Save-Ledger
  $result = "OK:$pkNo|$($state.h3No)"
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
