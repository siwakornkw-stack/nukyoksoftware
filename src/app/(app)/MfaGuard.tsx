"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// Client half of the admin two-step-login gate (see (app)/layout.tsx): layouts
// persist across client navigation, so the server redirect alone would only
// apply to the first page load.
export function MfaGuard({ need }: { need: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (need && !pathname.startsWith("/account")) router.replace("/account");
  }, [need, pathname, router]);
  return null;
}
