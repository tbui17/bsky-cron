import { AtpAgent } from "@atproto/api";
import * as dotenv from "dotenv";
import * as process from "process";

dotenv.config();

const handle = process.env.BLUESKY_HANDLE;
const password = process.env.BLUESKY_PASSWORD;

if (!handle || !password) {
  console.error(
    "Error: BLUESKY_HANDLE and BLUESKY_PASSWORD must be set in .env",
  );
  process.exit(1);
}

const agent = new AtpAgent({
  service: "https://bsky.social",
});

async function postToBluesky() {
  try {
    await agent.login({
      identifier: handle,
      password: password,
    });

    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    const message = `Hello ${randomNumber}`;

    const response = await agent.post({
      text: message,
    });

    console.log(`Successfully posted: "${message}"`);
    console.log(`Post URI: ${response.uri}`);
  } catch (error) {
    console.error("Error posting to Bluesky:", error);
    process.exit(1);
  }
}

postToBluesky();
