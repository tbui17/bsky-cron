import * as dotenv from "dotenv";
import { Scheduler } from "./scheduler/scheduler";
import { db } from "./db/client";
import { BlueskyClient } from "./bluesky/client";
import { logger } from "./logger";

dotenv.config();

async function main() {
  try {
    const scheduler = new Scheduler(db, BlueskyClient.createDefault());
    await scheduler.run();
  } catch (error) {
    logger.error(error, "Fatal error in main");
    process.exit(1);
  }
}

main();
