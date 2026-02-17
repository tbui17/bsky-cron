import { describe, expect, it } from "bun:test";
import { loginToBluesky, postToBluesky } from "../bluesky/client";

describe("Bluesky Integration", () => {
  it("should login to Bluesky", async () => {
    await loginToBluesky();
  });

  it("should post to Bluesky", async () => {
    const testMessage = `Test post from CI/CD at ${new Date().toISOString()}`;
    const response = await postToBluesky(testMessage);

    expect(response.uri).toBeDefined();
    expect(response.cid).toBeDefined();
  });
});
