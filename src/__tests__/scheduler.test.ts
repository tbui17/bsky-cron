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
import { ScheduledPost } from "../scheduler/scheduled-post";
import { configs } from "../../prisma.config.test";
import type { BlueskyClientInterface } from "../types";

const TEST_DB_CONNECTION = configs.datasource.url;

// Simple mock Bluesky client for testing
class MockBlueskyClient implements BlueskyClientInterface {
  private postedTexts: string[] = [];

  async post(text: string): Promise<{ uri: string; cid: string }> {
    this.postedTexts.push(text);
    return {
      uri: `at://mock/${text.slice(0, 10)}`,
      cid: "mock-cid",
    };
  }

  getPostedTexts(): string[] {
    return this.postedTexts;
  }

  clear() {
    this.postedTexts = [];
  }
}

describe("Scheduler Unit Tests", () => {
  describe("shouldSendPost()", () => {
    it("should return true for post that exists and is not sent", () => {
      const scheduler = new Scheduler({} as any, {} as any);
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 30);

      const mockPost = {
        id: 1,
        body: "Test",
        time: past,
        sentTime: null,
        createdAt: now,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);

      expect(scheduler.shouldSendPost(scheduledPost)).toBe(true);
    });

    it("should return false when no post exists", () => {
      const scheduler = new Scheduler({} as any, {} as any);
      const now = new Date("2024-01-15T12:00:00Z");

      const scheduledPost = new ScheduledPost(null, now);

      expect(scheduler.shouldSendPost(scheduledPost)).toBe(false);
    });

    it("should return false when post is already sent", () => {
      const scheduler = new Scheduler({} as any, {} as any);
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 30);

      const mockPost = {
        id: 1,
        body: "Test",
        time: past,
        sentTime: past, // Already sent
        createdAt: now,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);

      expect(scheduler.shouldSendPost(scheduledPost)).toBe(false);
    });
  });

  describe("getStatusMessage()", () => {
    it("should return empty database message", () => {
      const scheduler = new Scheduler({} as any, {} as any);
      const now = new Date("2024-01-15T12:00:00Z");

      const scheduledPost = new ScheduledPost(null, now);

      expect(scheduler.getStatusMessage(scheduledPost)).toBe(
        "No posts scheduled in database",
      );
    });

    it("should return message containing time values for future post", () => {
      const scheduler = new Scheduler({} as any, {} as any);
      const now = new Date("2024-01-15T12:00:00Z");
      const future = new Date(now.getTime() + 1000 * 60 * 90); // 1h 30m

      const mockPost = {
        id: 1,
        body: "Test",
        time: future,
        sentTime: null,
        createdAt: now,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);
      const message = scheduler.getStatusMessage(scheduledPost);

      // Check for time values using regex
      expect(message).toMatch(/.*\d+h.*\d+m.*/);
    });
  });
});

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
    mockBluesky.clear();
    scheduler = new Scheduler(db, mockBluesky);
  });

  describe("Empty database", () => {
    it("should return null when no posts exist", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      mockDateProvider.setTime(now);

      const result = await scheduler.run();

      expect(result).toBeNull();
    });
  });

  describe("Future posts only", () => {
    it("should return null when only future posts exist", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const future = new Date(now.getTime() + 1000 * 60 * 60 * 2);
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Future post",
        time: future,
        sentTime: null,
      });

      const result = await scheduler.run();

      expect(result).toBeNull();
    });
  });

  describe("Past sent posts", () => {
    it("should return null when all past posts are sent", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Already sent post",
        time: past,
        sentTime: past,
      });

      const result = await scheduler.run();

      expect(result).toBeNull();
    });
  });

  describe("Past unsent posts", () => {
    it("should send post when past unsent post exists", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 30);
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Ready to send post",
        time: past,
        sentTime: null,
      });

      const result = await scheduler.run();

      expect(result).not.toBeNull();
      expect(result?.body).toBe("Ready to send post");
    });

    it("should mark post as sent after successful post", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 30);
      mockDateProvider.setTime(now);

      const post = await db.createPost({
        body: "Post to mark as sent",
        time: past,
        sentTime: null,
      });

      await scheduler.run();

      const updatedPost = await db.findPostById(post.id);
      expect(updatedPost?.sentTime).not.toBeNull();
    });

    it("should send the most recent past post when multiple exist", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const oneHourAgo = new Date(now.getTime() - 1000 * 60 * 60);
      const thirtyMinutesAgo = new Date(now.getTime() - 1000 * 60 * 30);
      mockDateProvider.setTime(now);

      await db.createPosts([
        { body: "Older post", time: oneHourAgo, sentTime: null },
        { body: "Most recent post", time: thirtyMinutesAgo, sentTime: null },
      ]);

      const result = await scheduler.run();

      expect(result?.body).toBe("Most recent post");
    });
  });

  describe("Mixed posts scenario", () => {
    it("should return null when most recent past post is already sent (earlier unsent posts are skipped)", async () => {
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

      // Scheduler only checks most recent past post (3 AM), which is already sent.
      // It does not scan backwards to find 2 AM unsent.
      // Returns null since 5 AM is in the future.
      expect(result).toBeNull();
    });

    it("should not send anything when most recent past post is already sent and no earlier unsent posts", async () => {
      const now = new Date("2024-01-15T04:00:00Z");
      mockDateProvider.setTime(now);

      await db.createPosts([
        {
          body: "1 AM sent",
          time: new Date("2024-01-15T01:00:00Z"),
          sentTime: new Date("2024-01-15T01:05:00Z"),
        },
        {
          body: "2 AM sent",
          time: new Date("2024-01-15T02:00:00Z"),
          sentTime: new Date("2024-01-15T02:05:00Z"),
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

      expect(result).toBeNull();
    });
  });
});
