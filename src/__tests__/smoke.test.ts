import { describe, it, expect, afterAll } from "bun:test";
import { DbClient } from "../db/db-client";

describe("Smoke Test - Production DB Connection", () => {
  const db = DbClient.createDefault();

  afterAll(async () => {
    await db.disconnect();
  });

  it("should connect to production database", async () => {
    const count = await db.getPostCount();
    expect(typeof count).toBe("number");
  });
});
