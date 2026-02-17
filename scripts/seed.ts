import { DbClient } from "../src/db/db-client";
import { logger } from "../src/logger";
import * as fs from "fs";
import * as path from "path";

const db = DbClient.createDefault();

async function seed() {
  logger.info("Starting database seed...");

  const csvPath = path.join(process.cwd(), "data.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");
  const lines = csvContent.split("\n").filter((line) => line.trim());

  const dataLines = lines.slice(1);

  logger.info(`Found ${dataLines.length} rows to import`);

  for (const line of dataLines) {
    const match = line.match(/^"(.*)","(.*)"$/);
    if (!match) continue;

    const [, body, timeStr] = match;
    const time = new Date(timeStr);

    await db.createPost({
      body: body.replace(/""/g, '"'),
      time,
      sentTime: null,
    });
  }

  logger.info("Seed completed successfully");
}

seed()
  .catch((e) => {
    logger.error(e, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await db.disconnect();
  });
