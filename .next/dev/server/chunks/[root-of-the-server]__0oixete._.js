module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/src/lib/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "prisma",
    ()=>prisma
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__ = __turbopack_context__.i("[externals]/@prisma/client [external] (@prisma/client, cjs, [project]/node_modules/@prisma/client)");
;
// Single Prisma client reused across hot reloads / requests.
const g = globalThis;
const prisma = g.prisma ?? new __TURBOPACK__imported__module__$5b$externals$5d2f40$prisma$2f$client__$5b$external$5d$__$2840$prisma$2f$client$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$prisma$2f$client$29$__["PrismaClient"]({
    log: ("TURBOPACK compile-time truthy", 1) ? [
        "warn",
        "error"
    ] : "TURBOPACK unreachable"
});
if ("TURBOPACK compile-time truthy", 1) g.prisma = prisma;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/util [external] (util, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("util", () => require("util"));

module.exports = mod;
}),
"[project]/src/lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearSessionCookie",
    ()=>clearSessionCookie,
    "getSession",
    ()=>getSession,
    "hashPassword",
    ()=>hashPassword,
    "requireSession",
    ()=>requireSession,
    "setSessionCookie",
    ()=>setSessionCookie,
    "signToken",
    ()=>signToken,
    "verifyPassword",
    ()=>verifyPassword,
    "verifyToken",
    ()=>verifyToken
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jsonwebtoken$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jsonwebtoken/index.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$bcryptjs__$5b$external$5d$__$28$bcryptjs$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$bcryptjs$29$__ = __turbopack_context__.i("[externals]/bcryptjs [external] (bcryptjs, cjs, [project]/node_modules/bcryptjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
;
;
;
// Unified app auth (JWT in an httpOnly cookie) shared by all three modules.
// Fail closed in production if the secret is unset; only fall back in dev so a
// misconfigured VPS cannot silently sign tokens with a publicly-known constant.
// Resolved lazily so `next build` (which runs with NODE_ENV=production but no
// runtime env) does not throw at import time.
function getSecret() {
    const s = process.env.JWT_ACCESS_SECRET;
    if (s) return s;
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return "dev-insecure-secret-change-me";
}
const LIFETIME = process.env.JWT_ACCESS_LIFETIME || "7d";
const COOKIE = "dvk_session";
function hashPassword(pw) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$bcryptjs__$5b$external$5d$__$28$bcryptjs$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$bcryptjs$29$__["default"].hash(pw, 10);
}
function verifyPassword(pw, hash) {
    return __TURBOPACK__imported__module__$5b$externals$5d2f$bcryptjs__$5b$external$5d$__$28$bcryptjs$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$bcryptjs$29$__["default"].compare(pw, hash);
}
function signToken(s) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jsonwebtoken$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].sign(s, getSecret(), {
        expiresIn: LIFETIME
    });
}
function verifyToken(token) {
    try {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jsonwebtoken$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].verify(token, getSecret());
    } catch  {
        return null;
    }
}
async function setSessionCookie(token) {
    const c = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    c.set(COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: ("TURBOPACK compile-time value", "development") === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7
    });
}
async function clearSessionCookie() {
    const c = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    c.delete(COOKIE);
}
async function getSession() {
    const c = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const token = c.get(COOKIE)?.value;
    return token ? verifyToken(token) : null;
}
async function requireSession() {
    const s = await getSession();
    if (!s) throw new Error("UNAUTHENTICATED");
    return s;
}
}),
"[project]/src/lib/tenant.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Single-company install: every module scopes queries to this tenant.
// Kept as a constant (matching prisma/seed.ts) so multi-tenant support in the
// carried-over fleet schema stays intact without a refactor.
__turbopack_context__.s([
    "DEFAULT_TENANT_ID",
    ()=>DEFAULT_TENANT_ID
]);
const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
}),
"[project]/src/lib/fleet/queries.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "dec",
    ()=>dec,
    "getFleetSummary",
    ()=>getFleetSummary,
    "getMonthlyFinance",
    ()=>getMonthlyFinance
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/tenant.ts [app-route] (ecmascript)");
;
;
const dec = (d)=>d == null ? 0 : Number(d);
async function getFleetSummary(from, to) {
    const T = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_TENANT_ID"];
    const now = new Date();
    const rangeStart = from ?? new Date(now.getFullYear(), 0, 1);
    const rangeEnd = to ?? new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    const t30 = new Date(now.getTime() - 30 * 86400000);
    const t60 = new Date(now.getTime() - 60 * 86400000);
    const t90 = new Date(now.getTime() - 90 * 86400000);
    // Aggregate installments in the DB instead of loading every row into memory.
    const instAgg = (where)=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.aggregate({
            _sum: {
                Amount: true
            },
            _count: true,
            where: {
                Vehicle: {
                    TenantId: T
                },
                ...where
            }
        });
    const [vehicleCount, incomeAgg, repairAgg, gasAgg, outAgg, recvAgg, overAgg, b1, b2, b3, b4, dueRows] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].vehicle.count({
            where: {
                TenantId: T,
                Status: "active"
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].incomeVehicle.aggregate({
            _sum: {
                AmountReceive: true
            },
            where: {
                TenantId: T,
                DateTime: {
                    gte: rangeStart,
                    lte: rangeEnd
                }
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].repairVehicle.aggregate({
            _sum: {
                CompanyPay: true
            },
            where: {
                Vehicle: {
                    TenantId: T
                },
                RepairDate: {
                    gte: rangeStart,
                    lte: rangeEnd
                }
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].gasolineCost.aggregate({
            _sum: {
                Amount: true
            },
            where: {
                Vehicle: {
                    TenantId: T
                },
                DateTime: {
                    gte: rangeStart,
                    lte: rangeEnd
                }
            }
        }),
        instAgg({
            DatePay: null
        }),
        instAgg({
            DatePay: {
                not: null
            }
        }),
        instAgg({
            DatePay: null,
            DueDate: {
                lt: now
            }
        }),
        instAgg({
            DatePay: null,
            DueDate: {
                gte: t30,
                lt: now
            }
        }),
        instAgg({
            DatePay: null,
            DueDate: {
                gte: t60,
                lt: t30
            }
        }),
        instAgg({
            DatePay: null,
            DueDate: {
                gte: t90,
                lt: t60
            }
        }),
        instAgg({
            DatePay: null,
            DueDate: {
                lt: t90
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.findMany({
            where: {
                Vehicle: {
                    TenantId: T
                },
                DatePay: null
            },
            include: {
                Vehicle: {
                    select: {
                        VehicleId: true,
                        LicensePlatePrefix: true,
                        LicensePlateSuffix: true
                    }
                }
            },
            orderBy: {
                DueDate: "asc"
            },
            take: 15
        })
    ]);
    const bucket = (agg, label)=>({
            bucket: label,
            amount: dec(agg._sum.Amount),
            count: agg._count
        });
    const agingBuckets = [
        bucket(b1, "1-30 วัน"),
        bucket(b2, "31-60 วัน"),
        bucket(b3, "61-90 วัน"),
        bucket(b4, "90+ วัน")
    ].filter((b)=>b.count > 0);
    const dueSoon = dueRows.map((i)=>({
            vehicleId: i.Vehicle.VehicleId,
            plate: `${i.Vehicle.LicensePlatePrefix} ${i.Vehicle.LicensePlateSuffix}`,
            installmentNumber: i.InstallmentNumber,
            dueDate: i.DueDate.toISOString().slice(0, 10),
            amount: dec(i.Amount),
            overdueDays: Math.floor((now.getTime() - i.DueDate.getTime()) / 86400000)
        }));
    return {
        vehicleCount,
        income: dec(incomeAgg._sum.AmountReceive),
        expense: dec(repairAgg._sum.CompanyPay) + dec(gasAgg._sum.Amount),
        ar: {
            outstanding: dec(outAgg._sum.Amount),
            outstandingCount: outAgg._count,
            overdue: dec(overAgg._sum.Amount),
            overdueCount: overAgg._count,
            received: dec(recvAgg._sum.Amount),
            receivedCount: recvAgg._count,
            agingBuckets,
            dueSoon
        }
    };
}
async function getMonthlyFinance(months = 12) {
    const T = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_TENANT_ID"];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const [incomes, repairs, gas] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].incomeVehicle.findMany({
            where: {
                TenantId: T,
                DateTime: {
                    gte: start
                }
            },
            select: {
                DateTime: true,
                AmountReceive: true
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].repairVehicle.findMany({
            where: {
                Vehicle: {
                    TenantId: T
                },
                RepairDate: {
                    gte: start
                }
            },
            select: {
                RepairDate: true,
                CompanyPay: true
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].gasolineCost.findMany({
            where: {
                Vehicle: {
                    TenantId: T
                },
                DateTime: {
                    gte: start
                }
            },
            select: {
                DateTime: true,
                Amount: true
            }
        })
    ]);
    const map = new Map();
    const key = (d)=>d.toISOString().slice(0, 7);
    for (const i of incomes){
        const m = map.get(key(i.DateTime)) ?? {
            income: 0,
            expense: 0
        };
        m.income += dec(i.AmountReceive);
        map.set(key(i.DateTime), m);
    }
    for (const r of repairs){
        const m = map.get(key(r.RepairDate)) ?? {
            income: 0,
            expense: 0
        };
        m.expense += dec(r.CompanyPay);
        map.set(key(r.RepairDate), m);
    }
    for (const g of gas){
        const m = map.get(key(g.DateTime)) ?? {
            income: 0,
            expense: 0
        };
        m.expense += dec(g.Amount);
        map.set(key(g.DateTime), m);
    }
    return [
        ...map.entries()
    ].sort((a, z)=>a[0].localeCompare(z[0])).map(([month, v])=>({
            month,
            ...v
        }));
}
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/src/lib/storage.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "del",
    ()=>del,
    "get",
    ()=>get,
    "publicUrl",
    ()=>publicUrl,
    "put",
    ()=>put
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
;
;
// Local-filesystem storage (VPS). Replaces Vercel Blob from the source projects.
// Keys are "/"-separated logical paths, e.g. "fuel/2026-07/<uuid>.jpg".
// Files are served back through the /uploads/[...path] route (or nginx).
const ROOT = process.env.UPLOAD_DIR ? __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].resolve(process.env.UPLOAD_DIR) : __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), "var", "uploads");
function resolveKey(key) {
    const normalized = key.replace(/^\/+/, "");
    const abs = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].resolve(ROOT, normalized);
    const rel = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].relative(ROOT, abs);
    if (rel.startsWith("..") || __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].isAbsolute(rel)) {
        throw new Error("invalid storage key: " + key);
    }
    return abs;
}
function publicUrl(key) {
    return "/uploads/" + key.replace(/^\/+/, "");
}
async function put(key, data) {
    const dest = resolveKey(key);
    await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].mkdir(__TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].dirname(dest), {
        recursive: true
    });
    await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].writeFile(dest, data);
    return {
        key,
        url: publicUrl(key)
    };
}
async function get(key) {
    try {
        return await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readFile(resolveKey(key));
    } catch  {
        return null;
    }
}
async function del(key) {
    try {
        await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].unlink(resolveKey(key));
    } catch  {
    // already gone
    }
}
}),
"[project]/src/app/api/fleet/installments/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/tenant.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fleet$2f$queries$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fleet/queries.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/storage.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
const dynamic = "force-dynamic";
async function GET(req) {
    const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSession"])();
    if (!session) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "unauthorized"
    }, {
        status: 401
    });
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "unpaid"; // unpaid | overdue | paid | all
    const vehicle = url.searchParams.get("vehicle") || undefined;
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.findMany({
        where: {
            Vehicle: {
                TenantId: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_TENANT_ID"]
            },
            ...vehicle ? {
                VehicleId: vehicle
            } : {},
            ...filter === "paid" ? {
                DatePay: {
                    not: null
                }
            } : {},
            ...filter === "unpaid" || filter === "overdue" ? {
                DatePay: null
            } : {}
        },
        include: {
            Vehicle: {
                select: {
                    VehicleId: true,
                    LicensePlatePrefix: true,
                    LicensePlateSuffix: true
                }
            }
        },
        orderBy: {
            DueDate: "asc"
        },
        take: 1000
    });
    const now = Date.now();
    let list = rows.map((i)=>{
        const overdueDays = i.DatePay ? 0 : Math.floor((now - i.DueDate.getTime()) / 86400000);
        return {
            id: i.InstallmentsVehicleId,
            vehicleId: i.Vehicle.VehicleId,
            plate: `${i.Vehicle.LicensePlatePrefix} ${i.Vehicle.LicensePlateSuffix}`,
            installmentNumber: i.InstallmentNumber,
            dueDate: i.DueDate.toISOString().slice(0, 10),
            amount: (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fleet$2f$queries$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["dec"])(i.Amount),
            datePay: i.DatePay ? i.DatePay.toISOString().slice(0, 10) : null,
            overdueDays
        };
    });
    if (filter === "overdue") list = list.filter((i)=>i.overdueDays > 0);
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        installments: list
    });
}
async function POST(req) {
    const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSession"])();
    if (!session) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "unauthorized"
    }, {
        status: 401
    });
    const contentType = req.headers.get("content-type") || "";
    // Mark-paid uses multipart/form-data so an optional evidence file can be attached.
    if (contentType.includes("multipart/form-data")) {
        const form = await req.formData();
        const action = String(form.get("action") || "");
        if (action !== "pay") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "unknown action"
        }, {
            status: 400
        });
        const id = String(form.get("id") || "");
        if (!id) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "missing id"
        }, {
            status: 400
        });
        const inst = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.findFirst({
            where: {
                InstallmentsVehicleId: id,
                Vehicle: {
                    TenantId: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_TENANT_ID"]
                }
            },
            select: {
                InstallmentsVehicleId: true
            }
        });
        if (!inst) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "not found"
        }, {
            status: 404
        });
        let evidenceUrl;
        const file = form.get("file");
        if (file instanceof File && file.size > 0) {
            const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
            const key = `fleet/installments/${id}/${(0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["randomUUID"])()}.${ext}`;
            const bytes = Buffer.from(await file.arrayBuffer());
            const stored = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$storage$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["put"])(key, bytes);
            evidenceUrl = stored.url;
        }
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.update({
            where: {
                InstallmentsVehicleId: id
            },
            data: {
                DatePay: new Date(),
                Status: "paid",
                UpdatedByUsername: session.username,
                ...evidenceUrl ? {
                    PaymentEvidence: evidenceUrl
                } : {}
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            evidence: evidenceUrl ?? null
        });
    }
    const body = await req.json().catch(()=>({}));
    const action = body.action;
    if (action === "pay") {
        if (!body.id) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "missing id"
        }, {
            status: 400
        });
        const inst = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.findFirst({
            where: {
                InstallmentsVehicleId: body.id,
                Vehicle: {
                    TenantId: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_TENANT_ID"]
                }
            },
            select: {
                InstallmentsVehicleId: true
            }
        });
        if (!inst) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "not found"
        }, {
            status: 404
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.update({
            where: {
                InstallmentsVehicleId: body.id
            },
            data: {
                DatePay: new Date(),
                Status: "paid",
                UpdatedByUsername: session.username
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true
        });
    }
    if (action === "generate") {
        const vehicleId = body.vehicleId;
        if (!vehicleId) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "missing vehicleId"
        }, {
            status: 400
        });
        const v = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].vehicle.findFirst({
            where: {
                VehicleId: vehicleId,
                TenantId: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$tenant$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEFAULT_TENANT_ID"]
            }
        });
        if (!v) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "not found"
        }, {
            status: 404
        });
        if (!v.InstallmentPeriods || !v.InstallmentAmount) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "รถคันนี้ยังไม่ได้ตั้งจำนวนงวด/ค่างวด"
            }, {
                status: 400
            });
        }
        const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.count({
            where: {
                VehicleId: vehicleId
            }
        });
        if (existing > 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "มีค่างวดอยู่แล้ว"
            }, {
                status: 400
            });
        }
        const start = body.startDate ? new Date(body.startDate) : new Date();
        const anchorDay = start.getUTCDate();
        const amount = Number(v.InstallmentAmount);
        const data = Array.from({
            length: v.InstallmentPeriods
        }, (_, idx)=>{
            const y = start.getUTCFullYear();
            const mo = start.getUTCMonth() + idx;
            // Clamp the day to the target month's length so a 29-31 anchor does not
            // roll forward into the following month.
            const lastDay = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
            const day = Math.min(anchorDay, lastDay);
            return {
                VehicleId: vehicleId,
                Status: "active",
                InstallmentNumber: idx + 1,
                DueDate: new Date(Date.UTC(y, mo, day)),
                Amount: amount,
                CreatedByUsername: session.username
            };
        });
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].installmentsVehicle.createMany({
            data
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true,
            created: data.length
        });
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "unknown action"
    }, {
        status: 400
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0oixete._.js.map