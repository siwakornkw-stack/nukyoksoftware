import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "./Sidebar";

// Shell for all authenticated modules. The proxy (src/proxy.ts) redirects
// unauthenticated users to /login; this is a defense-in-depth guard so page
// rendering never depends solely on the proxy.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <div className="flex min-h-screen">
      <Sidebar userName={session?.name || session?.username || "ผู้ใช้"} role={session?.role} />
      <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
    </div>
  );
}
