import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { DbClient } from "../db/db-client";
import { Scheduler } from "../scheduler/scheduler";
import { MockDateTimeProvider } from "../scheduler/date-provider";
import { configs } from "../../prisma.config.test";
import type { BlueskyClientInterface } from "../types";

const TEST_DB_CONNECTION = configs.datasource.url;

// Mock Bluesky client to track posted messages
class MockBlueskyClient implements BlueskyClientInterface {
  postedTexts: string[] = [];

  async post(text: string): Promise<{ uri: string; cid: string }> {
    this.postedTexts.push(text);
    return { uri: `at://mock/${text.slice(0, 10)}`, cid: "mock-cid" };
  }
}

describe("Scheduler Integration Tests", () => {
  const mockDateProvider = new MockDateTimeProvider(new Date());
  const db = DbClient.create(TEST_DB_CONNECTION, mockDateProvider);
  const mockBluesky = new MockBlueskyClient();
  let scheduler: Scheduler;

  beforeAll(async () => {
    await db.deleteAllPosts();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.deleteAllPosts();
    mockBluesky.postedTexts = [];
    scheduler = new Scheduler(db, mockBluesky);
  });

  it("should return null when database is empty", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    mockDateProvider.setTime(now);

    const result = await scheduler.run();

    expect(result).toBeNull();
    expect(mockBluesky.postedTexts).toHaveLength(0);
  });

  it("should return null and log upcoming time when only future posts exist", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 2); // 2 hours from now
    mockDateProvider.setTime(now);

    await db.createPost({ body: "Future post", time: future, sentTime: null });

    const result = await scheduler.run();

    expect(result).toBeNull();
    expect(mockBluesky.postedTexts).toHaveLength(0);
    // Status message should contain time values (e.g., "2h" or "1h 30m")
    const scheduledPost = await db.getNextPostToSend();
    expect(scheduledPost.getStatusMessage()).toMatch(/.*\d+h.*/);
  });

  it("should return null and log status when all past posts are already sent", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const past = new Date(now.getTime() - 1000 * 60 * 60);
    mockDateProvider.setTime(now);

    await db.createPost({ body: "Sent post", time: past, sentTime: past });

    const result = await scheduler.run();

    expect(result).toBeNull();
    expect(mockBluesky.postedTexts).toHaveLength(0);
  });

  it("should send post and mark as sent when unsent past post exists", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const past = new Date(now.getTime() - 1000 * 60 * 30);
    mockDateProvider.setTime(now);

    const createdPost = await db.createPost({
      body: "Ready to send",
      time: past,
      sentTime: null,
    });

    const result = await scheduler.run();

    expect(result).not.toBeNull();
    expect(result?.body).toBe("Ready to send");
    expect(mockBluesky.postedTexts).toContain("Ready to send");

    // Verify post was marked as sent in database
    const updatedPost = await db.findPostById(createdPost.id);
    expect(updatedPost?.sentTime).not.toBeNull();
  });

  it("should send most recent unsent post when multiple unsent past posts exist", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const twoHoursAgo = new Date(now.getTime() - 1000 * 60 * 60 * 2);
    const thirtyMinutesAgo = new Date(now.getTime() - 1000 * 60 * 30);
    mockDateProvider.setTime(now);

    await db.createPosts([
      { body: "Older post", time: twoHoursAgo, sentTime: null },
      { body: "Most recent", time: thirtyMinutesAgo, sentTime: null },
    ]);

    const result = await scheduler.run();

    expect(result?.body).toBe("Most recent");
    expect(mockBluesky.postedTexts).toHaveLength(1);
    expect(mockBluesky.postedTexts[0]).toBe("Most recent");
  });

  it("should handle complex mix of sent, unsent, and future posts", async () => {
    const now = new Date("2024-01-15T04:00:00Z");
    mockDateProvider.setTime(now);

    await db.createPosts([
      {
        body: "1 AM sent",
        time: new Date("2024-01-15T01:00:00Z"),
        sentTime: new Date("2024-01-15T01:05:00Z"),
      },
      {
        body: "2 AM unsent",
        time: new Date("2024-01-15T02:00:00Z"),
        sentTime: null,
      },
      {
        body: "3 AM sent",
        time: new Date("2024-01-15T03:00:00Z"),
        sentTime: new Date("2024-01-15T03:05:00Z"),
      },
      {
        body: "5 AM future",
        time: new Date("2024-01-15T05:00:00Z"),
        sentTime: null,
      },
    ]);

    const result = await scheduler.run();

    // Most recent past post (3 AM) is sent, scheduler skips it
    // Doesn't scan backwards, returns null since 5 AM is future
    expect(result).toBeNull();
    expect(mockBluesky.postedTexts).toHaveLength(0);
  });

  it("should send most recent unsent when earlier posts are sent", async () => {
    const now = new Date("2024-01-15T04:00:00Z");
    mockDateProvider.setTime(now);

    await db.createPosts([
      {
        body: "1 AM sent",
        time: new Date("2024-01-15T01:00:00Z"),
        sentTime: new Date("2024-01-15T01:05:00Z"),
      },
      {
        body: "2 AM unsent",
        time: new Date("2024-01-15T02:00:00Z"),
        sentTime: null,
      },
      {
        body: "3 AM unsent",
        time: new Date("2024-01-15T03:00:00Z"),
        sentTime: null,
      },
      {
        body: "5 AM future",
        time: new Date("2024-01-15T05:00:00Z"),
        sentTime: null,
      },
    ]);

    const result = await scheduler.run();

    // Should send the most recent unsent past post (3 AM)
    expect(result?.body).toBe("3 AM unsent");
    expect(mockBluesky.postedTexts).toContain("3 AM unsent");
  });
});
