import { getSession, isAdmin } from "@/lib/auth";
import RecordsView from "./RecordsView";

export default async function RecordsPage() {
  const s = await getSession();
  return <RecordsView admin={!!s && isAdmin(s)} />;
}
