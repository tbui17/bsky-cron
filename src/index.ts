import * as dotenv from "dotenv";
import { Scheduler } from "./scheduler/scheduler";
import { db } from "./db/client";
import { BlueskyClient } from "./bluesky/client";
import { logger } from "./logger";

dotenv.config();

async function main() {
  let exitCode = 0;

  try {
    const scheduler = new Scheduler(db, BlueskyClient.createDefault());
    await scheduler.run();
  } catch (error) {
    logger.error(error, "Fatal error in main");
    exitCode = 1;
  } finally {
    await db.disconnect();
    logger.info("Database disconnected, exiting");
    process.exit(exitCode);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down gracefully");
  await db.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down gracefully");
  await db.disconnect();
  process.exit(0);
});

main();
