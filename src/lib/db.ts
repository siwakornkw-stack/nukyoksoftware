// Fails the build if a client component ever reaches this module through its
// import chain, instead of shipping PrismaClient to the browser where touching
// a delegate throws at module scope and kills the render.
import "server-only";
import { PrismaClient } from "@prisma/client";

// Single Prisma client reused across hot reloads / requests.
const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  g.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") g.prisma = prisma;
