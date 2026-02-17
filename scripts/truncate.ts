import { DbClient } from "../src/db/db-client";

const db = DbClient.createDefault();

async function truncate() {
  await db.deleteAllPosts();
  console.log("Truncated all posts");
  await db.disconnect();
}

truncate();
