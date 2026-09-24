import type { Instrumentation } from "next";

// Unhandled errors in route handlers / server components reach the LINE admins
// (throttled per route in opsAlert). Server Action lookups from scanner bots are
// noise, not our bugs.
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const message = err instanceof Error ? err.message : String(err);
  if (/Failed to find Server Action/i.test(message)) return;
  const { opsAlert } = await import("@/lib/ops-alert");
  const path = request.path.split("?")[0];
  await opsAlert(`error|${request.method} ${path}`, "เว็บเกิดข้อผิดพลาด", `${request.method} ${path}\n${message.slice(0, 300)}`);
};
