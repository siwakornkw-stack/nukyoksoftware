import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession, REQUIRE_ADMIN_MFA } from "@/lib/auth";
import { Sidebar } from "./Sidebar";
import { MfaGuard } from "./MfaGuard";

// Shell for all authenticated modules. The proxy (src/proxy.ts) redirects
// unauthenticated users to /login; this is a defense-in-depth guard so page
// rendering never depends solely on the proxy.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  // Admins must turn on two-step login before using anything but /account.
  // The layout only runs on a full load; MfaGuard repeats the check on
  // client-side navigation.
  const needMfa = REQUIRE_ADMIN_MFA && session.role === "admin" && !session.mfa;
  const path = (await headers()).get("x-pathname") ?? "";
  if (needMfa && path && !path.startsWith("/account")) redirect("/account");
  return (
    <div className="flex min-h-screen">
      <MfaGuard need={needMfa} />
      <Sidebar userName={session?.name || session?.username || "ผู้ใช้"} role={session?.role} />
      {/* pt-16 clears the fixed mobile header the sidebar renders below md. */}
      <main className="flex-1 min-w-0 p-4 pt-16 md:p-6">{children}</main>
    </div>
  );
}
