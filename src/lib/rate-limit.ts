// Failed-login throttle. In memory: the web app runs as a single PM2 process
// (ecosystem.config.js), so one Map sees every attempt. A restart clears it.

const WINDOW_MS = 15 * 60 * 1000;
export const MAX_PER_ACCOUNT = 5; // per (ip, username)
export const MAX_PER_IP = 20; // per ip, catches one address trying many usernames
// Per username whatever the IP: a cap on guesses even if the client IP can be
// spoofed. Someone can lock an account for 15 minutes this way, but not guess on.
export const MAX_PER_USERNAME = 20;

interface Entry {
  fails: number;
  first: number; // start of the counting window
  blockedUntil: number;
}

export function createLoginLimiter(now: () => number = Date.now) {
  const entries = new Map<string, Entry>();

  const live = (key: string) => {
    const e = entries.get(key);
    if (!e) return null;
    const t = now();
    if (e.blockedUntil <= t && t - e.first > WINDOW_MS) {
      entries.delete(key);
      return null;
    }
    return e;
  };

  // [key, limit]. Without a known client IP every request would share one key,
  // so the per-IP rule would lock everybody out at once; it is skipped then.
  const keys = (ip: string | null, username: string): [string, number][] => {
    const u = username.toLowerCase();
    return [
      [`a:${ip ?? "?"}|${u}`, MAX_PER_ACCOUNT],
      [`u:${u}`, MAX_PER_USERNAME],
      ...(ip ? [[`i:${ip}`, MAX_PER_IP] as [string, number]] : []),
    ];
  };

  return {
    // Milliseconds until attempts are allowed again, or 0.
    retryAfter(ip: string | null, username: string): number {
      const t = now();
      return Math.max(0, ...keys(ip, username).map(([k]) => (live(k)?.blockedUntil ?? 0) - t));
    },

    fail(ip: string | null, username: string) {
      const t = now();
      for (const [k, limit] of keys(ip, username)) {
        const e = live(k) ?? { fails: 0, first: t, blockedUntil: 0 };
        e.fails++;
        if (e.fails >= limit) {
          e.blockedUntil = t + WINDOW_MS;
          e.fails = 0;
          e.first = t;
        }
        entries.set(k, e);
      }
      // Keep the map from growing without bound under a spray of usernames.
      if (entries.size > 10000) for (const k of [...entries.keys()]) live(k);
    },

    // Only the (ip, username) count resets; the username and IP caps keep counting.
    succeed(ip: string | null, username: string) {
      entries.delete(keys(ip, username)[0][0]);
    },
  };
}

export const loginLimiter = createLoginLimiter();

// X-Real-IP if nginx sets it (it overwrites any client value), else the LAST
// X-Forwarded-For hop, the one nginx appends. The first hop is whatever the
// client sent and could be changed on every attempt to dodge the limits.
export function clientIp(req: Request): string | null {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return hops.at(-1) ?? null;
}
