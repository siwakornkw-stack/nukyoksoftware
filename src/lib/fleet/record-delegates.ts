import { prisma } from "@/lib/db";
import type { RecordTypeDef } from "@/lib/fleet/record-types";

// Server-only half of the per-vehicle record registry. Kept apart from
// record-types.ts because that module is imported by a client component, and
// importing @/lib/db from the browser bundle pulls in PrismaClient.

// A minimal shape common to every delegate we use. Enough to call the CRUD
// methods generically without fighting Prisma's per-model generics.
interface GenericDelegate {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">;
  }): Promise<Record<string, unknown>[]>;
  create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  findUnique(args: { where: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
  delete(args: { where: Record<string, unknown> }): Promise<unknown>;
}

export function delegate(def: RecordTypeDef): GenericDelegate {
  return (prisma as unknown as Record<string, GenericDelegate>)[def.delegate];
}
