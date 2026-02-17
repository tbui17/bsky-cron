import {
  describe,
  expect,
  it,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test";
import { DbClient } from "../db/db-client";
import { ScheduledPost } from "../scheduler/scheduled-post";
import { MockDateTimeProvider } from "../scheduler/date-provider";
import { configs } from "../../prisma.config.test";

const TEST_DB_CONNECTION = configs.datasource.url;

describe("ScheduledPost", () => {
  const mockDateProvider = new MockDateTimeProvider(new Date());
  const db = DbClient.create(TEST_DB_CONNECTION, mockDateProvider);

  beforeAll(async () => {
    await db.deleteAllPosts();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.deleteAllPosts();
  });

  describe("hasPost()", () => {
    it("should return false when database is empty", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      mockDateProvider.setTime(now);

      const scheduledPost = await db.getNextPostToSend();

      expect(scheduledPost.hasPost()).toBe(false);
    });

    it("should return true when post exists", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
      mockDateProvider.setTime(now);

      await db.createPost({ body: "Test post", time: past, sentTime: null });

      const scheduledPost = await db.getNextPostToSend();

      expect(scheduledPost.hasPost()).toBe(true);
    });
  });

  describe("isReadyToSend()", () => {
    it("should return true for unsent past post", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);
      mockDateProvider.setTime(now);

      await db.createPost({ body: "Test post", time: past, sentTime: null });

      const scheduledPost = await db.getNextPostToSend();

      expect(scheduledPost.isReadyToSend()).toBe(true);
    });

    it("should return false for already sent post", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);
      mockDateProvider.setTime(now);

      await db.createPost({ body: "Sent post", time: past, sentTime: now });

      const scheduledPost = await db.getNextPostToSend();

      expect(scheduledPost.isReadyToSend()).toBe(false);
    });

    it("should return false for future post", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const future = new Date(now.getTime() + 1000 * 60 * 60);
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Future post",
        time: future,
        sentTime: null,
      });

      const scheduledPost = await db.getNextPostToSend();

      expect(scheduledPost.isReadyToSend()).toBe(false);
    });
  });

  describe("isAlreadySent()", () => {
    it("should return true for sent post", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);

      // Test domain object directly with sent post
      const mockPost = {
        id: 1,
        body: "Sent post",
        time: past,
        sentTime: now, // Already sent
        createdAt: past,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);

      expect(scheduledPost.isAlreadySent()).toBe(true);
    });

    it("should return false for unsent post", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);

      // Test domain object directly with unsent post
      const mockPost = {
        id: 1,
        body: "Unsent post",
        time: past,
        sentTime: null, // Not sent
        createdAt: past,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);

      expect(scheduledPost.isAlreadySent()).toBe(false);
    });
  });

  describe("getTimeUntil()", () => {
    it("should return positive milliseconds for future post", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const future = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Future post",
        time: future,
        sentTime: null,
      });

      const scheduledPost = await db.getNextPostToSend();
      const timeUntil = scheduledPost.getTimeUntil();

      expect(timeUntil).toBeGreaterThan(0);
      expect(timeUntil).toBe(1000 * 60 * 60); // 1 hour in ms
    });

    it("should return negative milliseconds for past post", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
      mockDateProvider.setTime(now);

      await db.createPost({ body: "Past post", time: past, sentTime: null });

      const scheduledPost = await db.getNextPostToSend();
      const timeUntil = scheduledPost.getTimeUntil();

      expect(timeUntil).toBeLessThan(0);
      expect(timeUntil).toBe(-1000 * 60 * 60); // -1 hour in ms
    });

    it("should throw error when no post available", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const scheduledPost = new ScheduledPost(null, now);

      expect(() => scheduledPost.getTimeUntil()).toThrow("No post available");
    });
  });

  describe("getTimeSince()", () => {
    it("should return positive milliseconds for past post", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);

      // Test domain object directly
      const mockPost = {
        id: 1,
        body: "Past post",
        time: past,
        sentTime: now,
        createdAt: past,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);
      const timeSince = scheduledPost.getTimeSince();

      expect(timeSince).toBeGreaterThan(0);
      expect(timeSince).toBe(1000 * 60 * 60); // 1 hour in ms
    });

    it("should throw error when no post available", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const scheduledPost = new ScheduledPost(null, now);

      expect(() => scheduledPost.getTimeSince()).toThrow("No post available");
    });
  });

  describe("getBody()", () => {
    it("should return post body", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 60);
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Test body content",
        time: past,
        sentTime: null,
      });

      const scheduledPost = await db.getNextPostToSend();

      expect(scheduledPost.getBody()).toBe("Test body content");
    });

    it("should throw error when no post available", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const scheduledPost = new ScheduledPost(null, now);

      expect(() => scheduledPost.getBody()).toThrow("No post available");
    });
  });

  describe("getStatusMessage()", () => {
    it("should return empty database message when no posts", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      mockDateProvider.setTime(now);

      const scheduledPost = await db.getNextPostToSend();
      const message = scheduledPost.getStatusMessage();

      expect(message).toBe("No posts scheduled in database");
    });

    it("should return upcoming post message with time remaining", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const future = new Date(now.getTime() + 1000 * 60 * 90); // 1h 30m from now
      mockDateProvider.setTime(now);

      await db.createPost({
        body: "Future post",
        time: future,
        sentTime: null,
      });

      const scheduledPost = await db.getNextPostToSend();
      const message = scheduledPost.getStatusMessage();

      expect(message).toMatch(/Next post scheduled in \d+h? ?\d*m/);
    });

    it("should return sent post message with time since", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 120); // 2 hours ago

      // Test domain object directly with sent post
      const mockPost = {
        id: 1,
        body: "Sent post",
        time: past,
        sentTime: past, // Already sent
        createdAt: past,
      };

      const scheduledPost = new ScheduledPost(mockPost, now);
      const message = scheduledPost.getStatusMessage();

      expect(message).toMatch(
        /Post already sent.*ago\. No upcoming posts scheduled/,
      );
    });

    it("should return ready message for post ready to send", async () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const past = new Date(now.getTime() - 1000 * 60 * 30); // 30 minutes ago
      mockDateProvider.setTime(now);

      await db.createPost({ body: "Ready post", time: past, sentTime: null });

      const scheduledPost = await db.getNextPostToSend();
      const message = scheduledPost.getStatusMessage();

      expect(message).toBe("Post is ready to send");
    });
  });
});
