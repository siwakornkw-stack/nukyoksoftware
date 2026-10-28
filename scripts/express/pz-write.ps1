param([string]$Dir, [string]$PlanFile, [string]$Ledger)
# Writes the PZ (PZ-จ่ายชำระหนี้-น้ำมัน) that pays one PK's R3 into an Express
# company folder, the way staff key a payment. 32-bit PowerShell only (VFP OLE
# DB provider). Plan: pz.mjs.
#
# Same rules as r3-write.ps1 / fuel-write.ps1: every table opened with INDEX (no
# structural-CDX flag), one small EXECSCRIPT per step on one connection, Thai
# text only as parameters, each appended record and each changed field (with
# its old value) logged to the ledger before the next step, and on any failure
# the appended records are deleted and the changed fields put back. MULTILOCKS
# keeps the R3's lock while the payment rows are appended to the same table.
#
# Prints one line: RESULT:OK:<pz> | RESULT:EXISTS:<pz> | RESULT:BUSY:<why> | RESULT:ERR:<message>
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$inv = [Globalization.CultureInfo]::InvariantCulture
$plan = [IO.File]::ReadAllText($PlanFile, [Text.Encoding]::UTF8) | ConvertFrom-Json
$state = [ordered]@{ payment = $plan.paymentId; pk = $plan.pkNo; r3 = $plan.r3No; dir = $Dir; started = (Get-Date).ToString("s"); status = "writing"; pzNo = ""; added = @(); changed = @() }
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

$date = ([string]$plan.date) -replace "-", ""
$amount = N2 ([double]$plan.amount)
$result = ""
$tables = @(@("aptrn", "pzap"), @("aprcpit", "pzit"), @("aprcpcq", "pzcq"), @("gljnl", "pzgj"), @("gljnlit", "pzgi"), @("apmas", "pzam"), @("apbal", "pzab"))

try {
  $cn.Open()
  Save-Ledger
  $open = "SET DELETED OFF`r`nSET EXACT OFF`r`nSET MULTILOCKS ON`r`nSET REPROCESS TO 5 SECONDS`r`n"
  foreach ($t in $tables) { $open += "USE $($t[0]) INDEX $($t[0]) SHARED IN 0 ALIAS $($t[1])`r`n" }
  [void](Run ($open + "RETURN 'ok'"))

  # Already paid by a PZ? (an earlier run whose answer was lost, or staff)
  $paid = Run ("LOCAL c`r`nc = ''`r`nSELECT pzit`r`nSCAN FOR docnum == PADR(p1, LEN(docnum)) AND LEFT(rcpnum, 2) == 'PZ' AND NOT DELETED()`r`n" +
    "SELECT pzap`r`nLOCATE FOR docnum == pzit.rcpnum AND rectyp = '9' AND docstat # 'C' AND NOT DELETED()`r`nIF FOUND()`r`nc = ALLTRIM(pzit.rcpnum)`r`nENDIF`r`n" +
    "SELECT pzit`r`nIF NOT EMPTY(c)`r`nEXIT`r`nENDIF`r`nENDSCAN`r`nRETURN c") @($plan.r3No)
  if ($paid) { $state.status = "exists"; $state.pzNo = $paid; Save-Ledger; $result = "EXISTS:$paid"; return }

  # Lock the R3 and the creditor's two balance rows before writing anything.
  $r3 = Run ("SELECT pzap`r`nLOCATE FOR docnum == PADR(p1, LEN(docnum)) AND rectyp = '3' AND docstat # 'C' AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`n" +
    "IF NOT RLOCK('pzap')`r`nRETURN 'LOCKED'`r`nENDIF`r`nRETURN TRANSFORM(RECNO('pzap')) + '|' + STR(pzap.remamt, 15, 2)") @($plan.r3No)
  $mas = Run "SELECT pzam`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('pzam'), TRANSFORM(RECNO('pzam')), 'LOCKED')" @($plan.supCode)
  $bal = Run "SELECT pzab`r`nLOCATE FOR supcod == PADR(p1, LEN(supcod)) AND NOT DELETED()`r`nIF NOT FOUND()`r`nRETURN 'NOTFOUND'`r`nENDIF`r`nRETURN IIF(RLOCK('pzab'), TRANSFORM(RECNO('pzab')), 'LOCKED')" @($plan.supCode)
  if ($r3 -eq "LOCKED" -or $mas -eq "LOCKED" -or $bal -eq "LOCKED") {
    $state.status = "busy"; Save-Ledger; $result = "BUSY:มีคนกำลังแก้ $($plan.r3No) หรือเจ้าหนี้ $($plan.supCode) ใน Express"; return
  }
  if ($r3 -eq "NOTFOUND") { throw "ไม่พบ $($plan.r3No) ใน Express" }
  if ($mas -eq "NOTFOUND" -or $bal -eq "NOTFOUND") { throw "ไม่พบเจ้าหนี้ $($plan.supCode) ใน APMAS/APBAL" }
  $r3Rec = [int]$r3.Split("|")[0]
  $remamt = $r3.Split("|")[1].Trim()
  if ($remamt -ne $amount) { throw "ยอดค้างของ $($plan.r3No) ใน Express คือ $remamt ไม่เท่ากับยอดในสลิป $amount" }

  # Next free PZ<BEyymmdd>-NN (deleted rows count too: numbers are never reused).
  $pzNo = Run "LOCAL n`r`nn = 0`r`nSELECT pzap`r`nSCAN FOR LEFT(docnum, LEN(p1)) == p1`r`nn = MAX(n, VAL(SUBSTR(docnum, LEN(p1) + 1, 2)))`r`nENDSCAN`r`nRETURN IIF(n >= 99, '', p1 + PADL(TRANSFORM(n + 1), 2, '0'))" @($plan.prefix)
  if (-not $pzNo) { throw "เลขที่ PZ ของวันนี้เต็ม (99)" }
  $state.pzNo = $pzNo; Save-Ledger

  # The payment, what it pays and how (transfer from the bank's payment type).
  [void](Append "pzap" ("rectyp WITH '9', docnum WITH p2, docdat WITH $(D 'p1'), refnum WITH p3, supcod WITH p4, youref WITH p5, duedat WITH $(D 'p1'), " +
    "bilnum WITH '~', amtrat0 WITH VAL(p6), netamt WITH VAL(p6), payamt WITH VAL(p6), cmplapp WITH 'Y', cmpldat WITH $(D 'p1'), docstat WITH 'M', " +
    "chqpay WITH VAL(p6), rcvamt WITH VAL(p6), chqpas WITH VAL(p6), srv_vattyp WITH '-', pvatprorat WITH '-', userid WITH p7, chgdat WITH DATE(), orgnum WITH 0") @(
    $date, $pzNo, $plan.refnum, $plan.supCode, $plan.youref, $amount, $plan.user))
  [void](Append "pzit" "rcpnum WITH p1, docnum WITH p2, rectyp WITH '3', payamt WITH VAL(p3), vatamt WITH 0" @($pzNo, $plan.r3No, $amount))
  [void](Append "pzcq" "rcpnum WITH p1, chqnum WITH LEFT(p2 + p1, 12), payamt WITH VAL(p3)" @($pzNo, $plan.payType, $amount))
  [void](Append "pzgj" ("jnltyp WITH p2, voudat WITH $(D 'p1'), voucher WITH p3, descrp WITH p4, trnstat WITH 'P', docstat WITH 'N', " +
    "creby WITH p5, credat WITH DATE(), userid WITH p5, chgdat WITH DATE()") @($date, $plan.jnlTyp, $pzNo, $plan.glDescr, $plan.user))
  $time = (Get-Date).ToString("HHmm")
  foreach ($g in @(@(" 2", $plan.drAcc, "0"), @(" 5", $plan.crAcc, "1"))) {
    [void](Append "pzgi" ("voucher WITH p2, seqit WITH p3, voudat WITH $(D 'p1'), accnum WITH p4, descrp WITH p5, trntyp WITH p6, " +
      "amount WITH VAL(p7), chgdat WITH DATE(), chgtim WITH p8") @($date, $pzNo, $g[0], $g[1], $plan.glDescr, $g[2], $amount, $time))
  }
  # The number must be unique (someone keying a PZ at the same moment).
  $n = Run "LOCAL n`r`nSELECT pzap`r`nCOUNT FOR docnum == PADR(p1, LEN(docnum)) AND NOT DELETED() TO n`r`nRETURN TRANSFORM(n)" @($pzNo)
  if ($n -ne "1") { throw "เลขที่ $pzNo ซ้ำ ($n ใบ)" }

  # The R3 is paid; the creditor's balance and period payments follow.
  Change "pzap" $r3Rec "payamt" "pzap.payamt + VAL(p4)" @($amount)
  Change "pzap" $r3Rec "remamt" "pzap.remamt - VAL(p4)" @($amount)
  Change "pzap" $r3Rec "cmplapp" "'Y'"
  Change "pzap" $r3Rec "cmpldat" (D "p4") @($date)
  Change "pzam" ([int]$mas) "balance" "pzam.balance - VAL(p4)" @($amount)
  # Test hook (never set in normal runs): fail with everything but APBAL written,
  # to prove the rollback restores rows, text, date and number fields.
  if ($env:PZ_TEST_FAIL_AT -eq "before-apbal") { [void](Run "USE pz_test_no_such_table IN 0`r`nRETURN 'x'") }
  Change "pzab" ([int]$bal) ([string]$plan.balColumn) "EVALUATE('pzab.' + p3) + VAL(p4)" @($amount)

  $state.status = "done"; Save-Ledger
  $result = "OK:$pzNo"
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
