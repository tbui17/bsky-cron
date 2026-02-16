import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { createPrismaClient } from "../db/client-factory";
import { getNextPostToSend, markPostAsSent } from "../db/posts";
import { MockDateTimeProvider } from "../scheduler/date-provider";

const TEST_DB_CONNECTION = "postgresql://postgres:postgres@localhost:5433/bsky_cron_test";

describe("Database Operations", () => {
  const prisma = createPrismaClient(TEST_DB_CONNECTION);

  beforeAll(async () => {
    // Clean up before tests
    await prisma.post.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should find the most recent post that needs to be sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const morePast = new Date(now.getTime() - 1000 * 60 * 60 * 2); // 2 hours ago

    // Create test posts - all in the past, most recent not sent
    await prisma.post.create({
      data: { body: "Older post", time: morePast, sentTime: null },
    });
    await prisma.post.create({
      data: { body: "Most recent post", time: past, sentTime: null },
    });

    const mockDateProvider = new MockDateTimeProvider(now);
    const nextPost = await getNextPostToSend(mockDateProvider);

    expect(nextPost).not.toBeNull();
    expect(nextPost?.body).toBe("Most recent post"); // Most recent past post
  });

  it("should not return posts that have already been sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60);

    // Create a sent post
    await prisma.post.create({
      data: { body: "Sent post", time: past, sentTime: now },
    });

    const mockDateProvider = new MockDateTimeProvider(now);
    const nextPost = await getNextPostToSend(mockDateProvider);

    expect(nextPost?.body).not.toBe("Sent post");
  });

  it("should mark a post as sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60);

    const post = await prisma.post.create({
      data: { body: "Test post", time: past, sentTime: null },
    });

    await markPostAsSent(post.id);

    const updated = await prisma.post.findUnique({ where: { id: post.id } });
    expect(updated?.sentTime).not.toBeNull();
  });
});

describe("Integration: 4AM scenario", () => {
  const prisma = createPrismaClient(TEST_DB_CONNECTION);

  beforeAll(async () => {
    await prisma.post.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
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
    await prisma.post.create({
      data: { 
        body: "1 AM post", 
        time: new Date("2024-01-15T01:00:00Z"), 
        sentTime: null 
      },
    });
    await prisma.post.create({
      data: { 
        body: "2 AM post", 
        time: new Date("2024-01-15T02:00:00Z"), 
        sentTime: null 
      },
    });
    await prisma.post.create({
      data: { 
        body: "3 AM post", 
        time: new Date("2024-01-15T03:00:00Z"), 
        sentTime: new Date("2024-01-15T03:05:00Z") 
      },
    });
    await prisma.post.create({
      data: { 
        body: "5 AM post", 
        time: new Date("2024-01-15T05:00:00Z"), 
        sentTime: null 
      },
    });

    // Execute: Try to get next post
    const nextPost = await getNextPostToSend(mockDateProvider);

    // Verify: Should return null because 5 AM post is in the future
    expect(nextPost).toBeNull();
  });

  it("should send 4 AM post when it's the most recent past post", async () => {
    // Clear previous posts
    await prisma.post.deleteMany();

    // Setup: Current time is 4:00 AM
    const currentTime = new Date("2024-01-15T04:00:00Z");
    const mockDateProvider = new MockDateTimeProvider(currentTime);

    // Create posts:
    // - 1:00 AM, not sent
    // - 2:00 AM, not sent
    // - 3:00 AM, sent
    // - 4:00 AM, not sent (current time)
    await prisma.post.create({
      data: { 
        body: "1 AM post", 
        time: new Date("2024-01-15T01:00:00Z"), 
        sentTime: null 
      },
    });
    await prisma.post.create({
      data: { 
        body: "2 AM post", 
        time: new Date("2024-01-15T02:00:00Z"), 
        sentTime: null 
      },
    });
    await prisma.post.create({
      data: { 
        body: "3 AM post", 
        time: new Date("2024-01-15T03:00:00Z"), 
        sentTime: new Date("2024-01-15T03:05:00Z") 
      },
    });
    await prisma.post.create({
      data: { 
        body: "4 AM post", 
        time: new Date("2024-01-15T04:00:00Z"), 
        sentTime: null 
      },
    });

    // Execute: Try to get next post
    const nextPost = await getNextPostToSend(mockDateProvider);

    // Verify: Should return 4 AM post
    expect(nextPost).not.toBeNull();
    expect(nextPost?.body).toBe("4 AM post");
  });
});
