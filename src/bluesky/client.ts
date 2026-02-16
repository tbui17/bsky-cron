import { AtpAgent } from "@atproto/api";
import * as dotenv from "dotenv";

dotenv.config();

const handle = process.env.BLUESKY_HANDLE;
const password = process.env.BLUESKY_PASSWORD;

if (!handle || !password) {
  throw new Error("BLUESKY_HANDLE and BLUESKY_PASSWORD must be set");
}

const agent = new AtpAgent({
  service: "https://bsky.social",
});

let isLoggedIn = false;

export async function loginToBluesky() {
  if (isLoggedIn) return;
  
  await agent.login({
    identifier: handle,
    password: password,
  });
  
  isLoggedIn = true;
}

export async function postToBluesky(text: string) {
  await loginToBluesky();
  
  const response = await agent.post({
    text,
  });

  return response;
}
