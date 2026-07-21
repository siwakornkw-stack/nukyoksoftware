import { prisma } from "@/lib/db";

// Server-only half of the master-data registry. Kept apart from master-types.ts
// because that module is imported by a client component: anything re-exported
// from it is bundled for the browser, and touching a prisma delegate at module
// scope throws there ("PrismaClient is unable to run in this browser").

// Typed as a minimal CRUD surface so the shared route handler can call
// findMany/create/findUnique/delete without per-type code.
interface Row {
  [k: string]: unknown;
}
interface Delegate {
  findMany(args: unknown): Promise<Row[]>;
  create(args: unknown): Promise<Row>;
  findUnique(args: unknown): Promise<Row | null>;
  delete(args: unknown): Promise<Row>;
}

const DELEGATES: Record<string, Delegate> = {
  "vehicle-type": prisma.vehicleType as unknown as Delegate,
  "vehicle-brand": prisma.vehicleBrand as unknown as Delegate,
  "vehicle-owner": prisma.vehicleOwner as unknown as Delegate,
  "vehicle-department": prisma.vehicleDepartment as unknown as Delegate,
  "vehicle-status": prisma.vehicleStatus as unknown as Delegate,
  "fuel-type": prisma.fuelType as unknown as Delegate,
  "payment-status": prisma.paymentStatus as unknown as Delegate,
  "vehicle-driver": prisma.vehicleDriver as unknown as Delegate,
};

export function getDelegate(key: string): Delegate | undefined {
  return DELEGATES[key];
}
