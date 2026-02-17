import { DbClient } from "./db-client";
import { SystemDateTimeProvider } from "../scheduler/date-provider";
import * as dotenv from "dotenv";

dotenv.config();

const globalForDb = globalThis as unknown as {
  db: DbClient | undefined;
};

export const db = globalForDb.db ?? DbClient.createDefault(new SystemDateTimeProvider());

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
