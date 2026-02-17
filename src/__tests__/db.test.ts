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
  const mockDateProvider = new MockDateTimeProvider(new Date());
  const db = DbClient.create(TEST_DB_CONNECTION, mockDateProvider);

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
    await db.createPosts([
      { body: "Older post", time: morePast, sentTime: null },
      { body: "Most recent post", time: past, sentTime: null },
    ]);

    mockDateProvider.setTime(now);
    const scheduledPost = await db.getNextPostToSend();

    expect(scheduledPost.hasPost()).toBe(true);
    expect(scheduledPost.isReadyToSend()).toBe(true);
    expect(scheduledPost.getBody()).toBe("Most recent post");
  });

  it("should not return posts that have already been sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60);

    // Create a sent post
    await db.createPost({ body: "Sent post", time: past, sentTime: now });

    mockDateProvider.setTime(now);
    const scheduledPost = await db.getNextPostToSend();

    // Since the past post is already sent, we should get an upcoming post (or no post)
    // Either way, the sent post should not be returned as ready to send
    if (scheduledPost.hasPost()) {
      expect(scheduledPost.isReadyToSend()).toBe(false);
    }
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
  const mockDateProvider = new MockDateTimeProvider(new Date());
  const db = DbClient.create(TEST_DB_CONNECTION, mockDateProvider);

  beforeEach(async () => {
    await db.deleteAllPosts();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  it("should not send anything when most recent post is in the future", async () => {
    // Setup: Current time is 4:00 AM
    const currentTime = new Date("2024-01-15T04:00:00Z");

    // Create posts:
    // - 1:00 AM, not sent
    // - 2:00 AM, not sent
    // - 3:00 AM, sent
    // - 5:00 AM, not sent (future)
    await db.createPosts([
      { body: "1 AM post", time: new Date("2024-01-15T01:00:00Z"), sentTime: null },
      { body: "2 AM post", time: new Date("2024-01-15T02:00:00Z"), sentTime: null },
      { body: "3 AM post", time: new Date("2024-01-15T03:00:00Z"), sentTime: new Date("2024-01-15T03:05:00Z") },
      { body: "5 AM post", time: new Date("2024-01-15T05:00:00Z"), sentTime: null },
    ]);

    // Execute: Try to get next post
    mockDateProvider.setTime(currentTime);
    const scheduledPost = await db.getNextPostToSend();

    // Verify: All past posts are sent, so we should get the upcoming 5 AM post
    expect(scheduledPost.hasPost()).toBe(true);
    expect(scheduledPost.isReadyToSend()).toBe(false); // Future post, not ready
    expect(scheduledPost.isAlreadySent()).toBe(false);
  });

  it("should send 3 AM post when it's the most recent past post", async () => {
    // Setup: Current time is 4:00 AM
    const currentTime = new Date("2024-01-15T04:00:00Z");

    // Create posts:
    // - 1:00 AM, not sent
    // - 2:00 AM, not sent
    // - 3:00 AM, sent
    // - 5:00 AM, not sent (future)
    await db.createPosts([
      { body: "1 AM post", time: new Date("2024-01-15T01:00:00Z"), sentTime: null },
      { body: "2 AM post", time: new Date("2024-01-15T02:00:00Z"), sentTime: null },
      { body: "3 AM post", time: new Date("2024-01-15T03:00:00Z"), sentTime: null },
      { body: "5 AM post", time: new Date("2024-01-15T05:00:00Z"), sentTime: null },
    ]);

    // Execute: Try to get next post
    mockDateProvider.setTime(currentTime);
    const scheduledPost = await db.getNextPostToSend();

    expect(scheduledPost.hasPost()).toBe(true);
    expect(scheduledPost.isReadyToSend()).toBe(true);
    expect(scheduledPost.getBody()).toBe("3 AM post");
  });
});
