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
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

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
"[project]/src/lib/fuel/db.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "billById",
    ()=>billById,
    "billsInMonth",
    ()=>billsInMonth,
    "dateKey",
    ()=>dateKey,
    "distinctEmployees",
    ()=>distinctEmployees,
    "employeeKey",
    ()=>employeeKey,
    "findByHash",
    ()=>findByHash,
    "findByReceiptNo",
    ()=>findByReceiptNo,
    "findDuplicateBill",
    ()=>findDuplicateBill,
    "insertBill",
    ()=>insertBill,
    "lastBillOf",
    ()=>lastBillOf,
    "monthKey",
    ()=>monthKey,
    "monthlyByEmployee",
    ()=>monthlyByEmployee,
    "queryBills",
    ()=>queryBills
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
function dateKey(b) {
    return (b.billDate ?? b.createdAt.toISOString().slice(0, 10)).slice(0, 10);
}
function monthKey(b) {
    return dateKey(b).slice(0, 7);
}
function employeeKey(b) {
    return b.employeeName || b.lineUserId;
}
function insertBill(b) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.create({
        data: {
            ...b,
            status: b.status ?? "ok"
        }
    });
}
function findByHash(hash) {
    if (!hash) return Promise.resolve(null);
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findFirst({
        where: {
            imageHash: hash
        }
    });
}
function findByReceiptNo(receiptNo) {
    if (!receiptNo) return Promise.resolve(null);
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findFirst({
        where: {
            receiptNo
        }
    });
}
function findDuplicateBill(b) {
    if (b.station == null || b.billDate == null || b.total == null) return Promise.resolve(null);
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findFirst({
        where: {
            station: b.station,
            billDate: b.billDate,
            total: b.total,
            ...b.billTime != null ? {
                billTime: b.billTime
            } : {}
        }
    });
}
function lastBillOf(lineUserId) {
    // The chronologically previous refuel (by receipt datetime), not just the
    // most recently inserted row — bills arrive out of order via LINE.
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findFirst({
        where: {
            lineUserId
        },
        orderBy: [
            {
                billDate: "desc"
            },
            {
                billTime: "desc"
            },
            {
                id: "desc"
            }
        ]
    });
}
function billById(id) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findUnique({
        where: {
            id
        }
    });
}
async function billsInMonth(ym) {
    // Push the month filter into the DB: billDate starts with "YYYY-MM", or (no
    // billDate) createdAt falls within the month.
    const start = new Date(`${ym}-01T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findMany({
        where: {
            OR: [
                {
                    billDate: {
                        startsWith: ym
                    }
                },
                {
                    AND: [
                        {
                            billDate: null
                        },
                        {
                            createdAt: {
                                gte: start,
                                lt: end
                            }
                        }
                    ]
                }
            ]
        },
        orderBy: [
            {
                billDate: "asc"
            },
            {
                billTime: "asc"
            },
            {
                id: "asc"
            }
        ]
    });
}
async function queryBills(filters = {}) {
    const { from, to, employee, status } = filters;
    // Push status + employee into the DB; keep the date-range filter in JS because
    // dateKey falls back to createdAt for rows without a billDate.
    const where = {};
    if (status) where.status = status;
    if (employee) {
        where.OR = [
            {
                employeeName: employee
            },
            {
                employeeName: null,
                lineUserId: employee
            }
        ];
    }
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findMany({
        where,
        orderBy: [
            {
                billDate: "desc"
            },
            {
                billTime: "desc"
            },
            {
                id: "desc"
            }
        ]
    });
    if (!from && !to) return rows;
    return rows.filter((b)=>{
        const dk = dateKey(b);
        if (from && dk < from) return false;
        if (to && dk > to) return false;
        return true;
    });
}
async function monthlyByEmployee() {
    const all = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findMany();
    const map = new Map();
    for (const b of all){
        const ym = monthKey(b);
        const employee = employeeKey(b);
        const key = `${ym} ${employee}`;
        const row = map.get(key) ?? {
            ym,
            employee,
            count: 0,
            liters: 0,
            baht: 0,
            suspects: 0
        };
        row.count++;
        row.liters += Number(b.liters ?? 0);
        row.baht += Number(b.total ?? 0);
        if (b.status === "suspect") row.suspects++;
        map.set(key, row);
    }
    return [
        ...map.values()
    ].sort((a, z)=>a.ym.localeCompare(z.ym) || a.employee.localeCompare(z.employee));
}
async function distinctEmployees() {
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].fuelBill.findMany({
        distinct: [
            "employeeName",
            "lineUserId"
        ],
        select: {
            employeeName: true,
            lineUserId: true
        }
    });
    return [
        ...new Set(rows.map(employeeKey))
    ].sort();
}
}),
"[project]/src/app/api/fuel/bills/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fuel$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/fuel/db.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
async function GET(req) {
    if (!await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSession"])()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "unauthorized"
        }, {
            status: 401
        });
    }
    const url = new URL(req.url);
    const filters = {
        from: url.searchParams.get("from") || undefined,
        to: url.searchParams.get("to") || undefined,
        employee: url.searchParams.get("employee") || undefined,
        status: url.searchParams.get("status") || undefined
    };
    const [rawBills, employees] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fuel$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["queryBills"])(filters),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$fuel$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["distinctEmployees"])()
    ]);
    // Convert Prisma Decimal money fields to numbers for the client.
    const bills = rawBills.map((b)=>({
            ...b,
            liters: b.liters == null ? null : Number(b.liters),
            pricePerLiter: b.pricePerLiter == null ? null : Number(b.pricePerLiter),
            total: b.total == null ? null : Number(b.total)
        }));
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        bills,
        employees
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0-0112p._.js.map