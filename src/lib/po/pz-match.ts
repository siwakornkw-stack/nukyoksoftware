// Matching a transfer slip to Express data. Pure: safe for client and server.

// Which of Express's bank accounts the slip's "from" account is: its visible
// digits ("xxx-x-x1029-x" -> 1029, "XXX-XXX826-8" -> 8268) found in the
// payment type's name or the account's name. Only a single match counts.
export function matchBank(fromAccount: string, banks: { code: string; name: string; accountName: string }[]): string {
  const digits = fromAccount.replace(/\D/g, "");
  if (digits.length < 3) return "";
  const hits = banks.filter((b) => [b.name, b.accountName].some((t) => t.replace(/\D/g, "").includes(digits)));
  return hits.length === 1 ? hits[0].code : "";
}

// The slip's payee against the R3 creditor ("นาย สุพัฒน์พงศ์  เทวาวณิชกิจ"),
// ignoring titles and spacing. Only a warning on the page: banks shorten names.
const nameKey = (s: string) =>
  s
    .trim()
    .replace(/^(นาย|นางสาว|นาง|น\.ส\.|mr\.?|mrs\.?|ms\.?)\s*/i, "")
    .replace(/\s+/g, "")
    .toLowerCase();
export function samePayee(toName: string, creditor: string): boolean {
  const a = nameKey(toName), b = nameKey(creditor);
  return !!a && !!b && (a.includes(b) || b.includes(a));
}
