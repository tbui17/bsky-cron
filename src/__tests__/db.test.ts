import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { DbClient } from "../db/db-client";
import { MockDateTimeProvider } from "../scheduler/date-provider";
import { configs } from "../../prisma.config.test";

const TEST_DB_CONNECTION = configs.datasource.url;

describe("Database Operations", () => {
  const db = DbClient.create(TEST_DB_CONNECTION);

  beforeAll(async () => {
    // Clean up before tests
    await db.deleteAllPosts();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should find the most recent post that needs to be sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const morePast = new Date(now.getTime() - 1000 * 60 * 60 * 2); // 2 hours ago

    // Create test posts - all in the past, most recent not sent
    await db.createPost({ body: "Older post", time: morePast, sentTime: null });
    await db.createPost({
      body: "Most recent post",
      time: past,
      sentTime: null,
    });

    const mockDateProvider = new MockDateTimeProvider(now);
    const nextPost = await db.getNextPostToSend(mockDateProvider);

    expect(nextPost).not.toBeNull();
    expect(nextPost?.body).toBe("Most recent post"); // Most recent past post
  });

  it("should not return posts that have already been sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60);

    // Create a sent post
    await db.createPost({ body: "Sent post", time: past, sentTime: now });

    const mockDateProvider = new MockDateTimeProvider(now);
    const nextPost = await db.getNextPostToSend(mockDateProvider);

    expect(nextPost?.body).not.toBe("Sent post");
  });

  it("should mark a post as sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60);

    const post = await db.createPost({
      body: "Test post",
      time: past,
      sentTime: null,
    });

    await db.markPostAsSent(post.id);

    const updated = await db.findPostById(post.id);
    expect(updated?.sentTime).not.toBeNull();
  });
});

describe("Integration: 4AM scenario", () => {
  const db = DbClient.create(TEST_DB_CONNECTION);

  beforeEach(async () => {
    await db.deleteAllPosts();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should not send anything when most recent post is in the future", async () => {
    // Setup: Current time is 4:00 AM
    const currentTime = new Date("2024-01-15T04:00:00Z");
    const mockDateProvider = new MockDateTimeProvider(currentTime);

    // Create posts:
    // - 1:00 AM, not sent
    // - 2:00 AM, not sent
    // - 3:00 AM, sent
    // - 5:00 AM, not sent (future)
    await db.createPost({
      body: "1 AM post",
      time: new Date("2024-01-15T01:00:00Z"),
      sentTime: null,
    });
    await db.createPost({
      body: "2 AM post",
      time: new Date("2024-01-15T02:00:00Z"),
      sentTime: null,
    });
    await db.createPost({
      body: "3 AM post",
      time: new Date("2024-01-15T03:00:00Z"),
      sentTime: new Date("2024-01-15T03:05:00Z"),
    });
    await db.createPost({
      body: "5 AM post",
      time: new Date("2024-01-15T05:00:00Z"),
      sentTime: null,
    });

    // Execute: Try to get next post
    const nextPost = await db.getNextPostToSend(mockDateProvider);

    // Verify: Should return null because 5 AM post is in the future
    expect(nextPost).toBeNull();
  });

  it("should send 4 AM post when it's the most recent past post", async () => {
    // Create posts directly
    await db.createPost({
      body: "1 AM post",
      time: new Date("2024-01-15T01:00:00Z"),
      sentTime: null,
    });
    await db.createPost({
      body: "2 AM post",
      time: new Date("2024-01-15T02:00:00Z"),
      sentTime: null,
    });
    await db.createPost({
      body: "3 AM post",
      time: new Date("2024-01-15T03:00:00Z"),
      sentTime: new Date("2024-01-15T03:05:00Z"),
    });
    await db.createPost({
      body: "4 AM post",
      time: new Date("2024-01-15T04:00:00Z"),
      sentTime: null,
    });

    // Setup: Current time is 4:00 AM
    const currentTime = new Date("2024-01-15T04:00:00Z");
    const mockDateProvider = new MockDateTimeProvider(currentTime);

    // Execute: Try to get next post
    const nextPost = await db.getNextPostToSend(mockDateProvider);

    // Verify: Should return 4 AM post
    expect(nextPost).not.toBeNull();
    expect(nextPost?.body).toBe("4 AM post");
  });
});
