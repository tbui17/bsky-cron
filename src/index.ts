import * as dotenv from "dotenv";
import { runScheduler } from "./scheduler/runner";
import { logger } from "./logger";

dotenv.config();

async function main() {
  try {
    await runScheduler();
    process.exit(0);
  } catch (error) {
    logger.error(error, "Fatal error in main");
    process.exit(1);
  }
}

main();
