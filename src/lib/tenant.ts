// Single-company install: every module scopes queries to this tenant.
// Kept as a constant (matching prisma/seed.ts) so multi-tenant support in the
// carried-over fleet schema stays intact without a refactor.
export const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
