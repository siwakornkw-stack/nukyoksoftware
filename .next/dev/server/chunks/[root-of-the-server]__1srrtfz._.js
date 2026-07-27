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
"[project]/src/lib/debt/store.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addVersion",
    ()=>addVersion,
    "getCurrentRecords",
    ()=>getCurrentRecords,
    "readVersions",
    ()=>readVersions,
    "setCurrentVersion",
    ()=>setCurrentVersion,
    "updateRecordStatus",
    ()=>updateRecordStatus
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/db.ts [app-route] (ecmascript)");
;
function toRecord(r) {
    return {
        id: r.id,
        docNo: r.docNo,
        docType: r.docType,
        date: r.date,
        customer: r.customer,
        project: r.project,
        taxId: r.taxId,
        dueDate: r.dueDate,
        branch: r.branch,
        value: Number(r.value),
        vat: Number(r.vat),
        total: Number(r.total),
        depositRef: r.depositRef,
        status: r.status,
        salesperson: r.salesperson
    };
}
async function readVersions() {
    const versions = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtVersion.findMany({
        orderBy: {
            uploadedAt: "desc"
        }
    });
    const current = versions.find((v)=>v.isCurrent) ?? null;
    return {
        currentVersionId: current?.id ?? null,
        versions: versions.map((v)=>({
                id: v.id,
                fileName: v.fileName,
                uploadedAt: v.uploadedAt.toISOString(),
                rowCount: v.rowCount,
                totalAmount: Number(v.totalAmount)
            }))
    };
}
async function getCurrentRecords() {
    const current = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtVersion.findFirst({
        where: {
            isCurrent: true
        }
    });
    if (!current) return {
        meta: null,
        records: []
    };
    const rows = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtRecord.findMany({
        where: {
            versionId: current.id
        }
    });
    return {
        meta: {
            id: current.id,
            fileName: current.fileName,
            uploadedAt: current.uploadedAt.toISOString(),
            rowCount: current.rowCount,
            totalAmount: Number(current.totalAmount)
        },
        records: rows.map(toRecord)
    };
}
async function addVersion(fileName, records) {
    const total = records.reduce((a, r)=>a + r.total, 0);
    const version = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction(async (tx)=>{
        await tx.debtVersion.updateMany({
            where: {
                isCurrent: true
            },
            data: {
                isCurrent: false
            }
        });
        const v = await tx.debtVersion.create({
            data: {
                fileName,
                rowCount: records.length,
                totalAmount: total,
                isCurrent: true
            }
        });
        if (records.length) {
            await tx.debtRecord.createMany({
                data: records.map((r)=>({
                        versionId: v.id,
                        docNo: r.docNo,
                        docType: r.docType,
                        date: r.date,
                        customer: r.customer,
                        project: r.project,
                        taxId: r.taxId,
                        dueDate: r.dueDate,
                        branch: r.branch,
                        value: r.value,
                        vat: r.vat,
                        total: r.total,
                        depositRef: r.depositRef,
                        status: r.status,
                        salesperson: r.salesperson
                    }))
            });
        }
        return v;
    });
    return {
        id: version.id,
        fileName: version.fileName,
        uploadedAt: version.uploadedAt.toISOString(),
        rowCount: version.rowCount,
        totalAmount: Number(version.totalAmount)
    };
}
async function setCurrentVersion(id) {
    const exists = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtVersion.findUnique({
        where: {
            id
        }
    });
    if (!exists) return false;
    await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].$transaction([
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtVersion.updateMany({
            where: {
                isCurrent: true
            },
            data: {
                isCurrent: false
            }
        }),
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtVersion.update({
            where: {
                id
            },
            data: {
                isCurrent: true
            }
        })
    ]);
    return true;
}
async function updateRecordStatus(docNo, status) {
    const current = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtVersion.findFirst({
        where: {
            isCurrent: true
        }
    });
    if (!current) return false;
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$db$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].debtRecord.updateMany({
        where: {
            versionId: current.id,
            docNo
        },
        data: {
            status
        }
    });
    return res.count > 0;
}
}),
"[project]/src/app/api/debt/records/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$debt$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/debt/store.ts [app-route] (ecmascript)");
;
;
;
const dynamic = "force-dynamic";
async function GET() {
    if (!await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSession"])()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "unauthorized"
        }, {
            status: 401
        });
    }
    const { meta, records } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$debt$2f$store$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCurrentRecords"])();
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        meta,
        records
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1srrtfz._.js.map