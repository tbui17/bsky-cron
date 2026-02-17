import { DbClient } from "../src/db/db-client";
import { SystemDateTimeProvider } from "../src/scheduler/date-provider";

const db = DbClient.createDefault(new SystemDateTimeProvider());

async function truncate() {
  await db.deleteAllPosts();
  console.log("Truncated all posts");
  await db.disconnect();
}

truncate();
