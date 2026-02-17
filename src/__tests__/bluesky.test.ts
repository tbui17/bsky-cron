import { describe, expect, it } from "bun:test";
import { BlueskyClient } from "../bluesky/client";

describe("Bluesky Integration", () => {
  it("should login to Bluesky", async () => {
    const client = BlueskyClient.createDefault();
    await client.login();
    expect(client.IsLoggedIn).toBe(true);
  });

  it.skipIf(!!process.env.CI)("should post to Bluesky", async () => {
    const client = BlueskyClient.createDefault();
    const testMessage = `Test post from CI at ${new Date().toISOString()}`;
    const response = await client.post(testMessage);

    expect(response.uri).toBeDefined();
    expect(response.cid).toBeDefined();
  });
});
