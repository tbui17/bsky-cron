import { db } from "./client";

async function truncate() {
  await db.deleteAllPosts();
  console.log("Truncated all posts");
  await db.disconnect();
}

truncate();
