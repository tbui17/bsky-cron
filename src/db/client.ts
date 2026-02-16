import { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./client-factory";
import * as dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DB_CONNECTION;

if (!connectionString) {
  throw new Error("DB_CONNECTION environment variable is not set");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
