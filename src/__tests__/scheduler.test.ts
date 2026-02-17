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

const TEST_DB_CONNECTION = configs.datasource.url;

describe("Scheduler Integration Tests", () => {
  const mockDateProvider = new MockDateTimeProvider(new Date());
  const db = DbClient.create(TEST_DB_CONNECTION, mockDateProvider);
  let scheduler: Scheduler;

  beforeAll(async () => {
    await db.deleteAllPosts();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await db.deleteAllPosts();
    // Create scheduler with dummy BlueskyClient - we won't use run()
    scheduler = new Scheduler(db, {} as any);
  });

  it("returns empty when database is empty", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    mockDateProvider.setTime(now);

    const scheduledPost = await scheduler.getNextPost();

    expect(scheduledPost.hasPost()).toBe(false);
    expect(scheduledPost.getStatusMessage()).toMatch(/No posts/);
  });

  it("returns future post when only future posts exist", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const future = new Date(now.getTime() + 1000 * 60 * 60 * 2);
    mockDateProvider.setTime(now);

    await db.createPost({ body: "Future post", time: future, sentTime: null });

    const scheduledPost = await scheduler.getNextPost();

    expect(scheduledPost.hasPost()).toBe(true);
    expect(scheduledPost.isReadyToSend()).toBe(false);
    expect(scheduledPost.getStatusMessage()).toMatch(/.*\d+h.*/);
  });

  it("returns empty when all past posts are already sent and no future posts", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const past = new Date(now.getTime() - 1000 * 60 * 60);
    mockDateProvider.setTime(now);

    await db.createPost({ body: "Sent post", time: past, sentTime: past });

    const scheduledPost = await scheduler.getNextPost();

    // No actionable posts - all past posts are sent, no future posts exist
    expect(scheduledPost.hasPost()).toBe(false);
  });

  it("returns ready post when unsent past post exists", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const past = new Date(now.getTime() - 1000 * 60 * 30);
    mockDateProvider.setTime(now);

    await db.createPost({ body: "Ready to send", time: past, sentTime: null });

    const scheduledPost = await scheduler.getNextPost();

    expect(scheduledPost.hasPost()).toBe(true);
    expect(scheduledPost.isReadyToSend()).toBe(true);
    expect(scheduledPost.getPost().body).toBe("Ready to send");
  });

  it("returns most recent unsent when multiple unsent past posts exist", async () => {
    const now = new Date("2024-01-15T12:00:00Z");
    const twoHoursAgo = new Date(now.getTime() - 1000 * 60 * 60 * 2);
    const thirtyMinutesAgo = new Date(now.getTime() - 1000 * 60 * 30);
    mockDateProvider.setTime(now);

    await db.createPosts([
      { body: "Older post", time: twoHoursAgo, sentTime: null },
      { body: "Most recent", time: thirtyMinutesAgo, sentTime: null },
    ]);

    const scheduledPost = await scheduler.getNextPost();

    expect(scheduledPost.isReadyToSend()).toBe(true);
    expect(scheduledPost.getPost().body).toBe("Most recent");
  });

  it("returns future post when most recent past is sent", async () => {
    const now = new Date("2024-01-15T04:00:00Z");
    mockDateProvider.setTime(now);

    await db.createPosts([
      { body: "3 AM sent", time: new Date("2024-01-15T03:00:00Z"), sentTime: new Date("2024-01-15T03:05:00Z") },
      { body: "5 AM future", time: new Date("2024-01-15T05:00:00Z"), sentTime: null },
    ]);

    const scheduledPost = await scheduler.getNextPost();

    expect(scheduledPost.hasPost()).toBe(true);
    expect(scheduledPost.isReadyToSend()).toBe(false);
    expect(scheduledPost.getPost().body).toBe("5 AM future");
  });

  it("returns most recent unsent from mix of sent and unsent", async () => {
    const now = new Date("2024-01-15T04:00:00Z");
    mockDateProvider.setTime(now);

    await db.createPosts([
      { body: "1 AM sent", time: new Date("2024-01-15T01:00:00Z"), sentTime: new Date("2024-01-15T01:05:00Z") },
      { body: "2 AM unsent", time: new Date("2024-01-15T02:00:00Z"), sentTime: null },
      { body: "3 AM unsent", time: new Date("2024-01-15T03:00:00Z"), sentTime: null },
    ]);

    const scheduledPost = await scheduler.getNextPost();

    expect(scheduledPost.isReadyToSend()).toBe(true);
    expect(scheduledPost.getPost().body).toBe("3 AM unsent");
  });
});
