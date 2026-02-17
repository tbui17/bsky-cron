import { createPrismaClient } from "./client-factory";
import type { DateTimeProvider } from "../scheduler/date-provider";
import { PrismaClient } from "../../prisma/generated/client";

export class DbClient {
  private prisma: PrismaClient;

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  static createDefault(): DbClient {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const prisma = createPrismaClient(connectionString);
    return new DbClient(prisma);
  }

  static create(connectionString: string): DbClient {
    const prisma = createPrismaClient(connectionString);
    return new DbClient(prisma);
  }

  async getNextPostToSend(dateProvider: DateTimeProvider) {
    const now = dateProvider.now();

    const mostRecentPost = await this.prisma.post.findFirst({
      orderBy: { time: "desc" },
    });

    if (!mostRecentPost || mostRecentPost.time > now) {
      return null;
    }

    if (mostRecentPost.sentTime !== null) {
      return null;
    }

    return mostRecentPost;
  }

  async markPostAsSent(postId: number) {
    return this.prisma.post.update({
      where: { id: postId },
      data: { sentTime: new Date() },
    });
  }

  async getPostCount() {
    return this.prisma.post.count();
  }

  async getSentPostCount() {
    return this.prisma.post.count({
      where: { sentTime: { not: null } },
    });
  }

  // Test helper methods
  async createPost(data: { body: string; time: Date; sentTime: Date | null }) {
    return this.prisma.post.create({ data });
  }

  async findPostById(id: number) {
    return this.prisma.post.findUnique({ where: { id } });
  }

  async deleteAllPosts() {
    return this.prisma.post.deleteMany();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
