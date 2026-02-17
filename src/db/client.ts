import { DbClient } from "./db-client";
import * as dotenv from "dotenv";

dotenv.config();

const globalForDb = globalThis as unknown as {
  db: DbClient | undefined;
};

export const db = globalForDb.db ?? DbClient.createDefault();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
