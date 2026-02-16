import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { prisma } from "../db/client";
import { getNextPostToSend, markPostAsSent } from "../db/posts";

describe("Database Operations", () => {
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
    const future = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

    // Create test posts
    await prisma.post.create({
      data: { body: "Past post 1", time: new Date(past.getTime() - 1000 * 60 * 60), sentTime: null },
    });
    await prisma.post.create({
      data: { body: "Past post 2", time: past, sentTime: null },
    });
    await prisma.post.create({
      data: { body: "Future post", time: future, sentTime: null },
    });

    const nextPost = await getNextPostToSend();

    expect(nextPost).not.toBeNull();
    expect(nextPost?.body).toBe("Past post 2"); // Most recent past post
  });

  it("should not return posts that have already been sent", async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60);

    // Create a sent post
    await prisma.post.create({
      data: { body: "Sent post", time: past, sentTime: now },
    });

    const nextPost = await getNextPostToSend();

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
