import { createPrismaClient } from "./client-factory";
import type { DateTimeProvider } from "../scheduler/date-provider";
import { SystemDateTimeProvider } from "../scheduler/date-provider";

export class DbClient {
  private prisma: ReturnType<typeof createPrismaClient>;
  private dateProvider: DateTimeProvider;

  private constructor(prisma: ReturnType<typeof createPrismaClient>, dateProvider: DateTimeProvider) {
    this.prisma = prisma;
    this.dateProvider = dateProvider;
  }

  static createDefault(): DbClient {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const prisma = createPrismaClient(connectionString);
    return new DbClient(prisma, new SystemDateTimeProvider());
  }

  static create(connectionString: string, dateProvider: DateTimeProvider): DbClient {
    const prisma = createPrismaClient(connectionString);
    return new DbClient(prisma, dateProvider);
  }

  async getNextPostToSend() {
    const now = this.dateProvider.now();

    const mostRecentPost = await this.prisma.post.findFirst({
      where: {
        time: { lte: now },
      },
      orderBy: { time: "desc" },
      take: 1,
    });

    if (!mostRecentPost || mostRecentPost.time > now) {
      return null;
    }

    if (mostRecentPost.sentTime !== null) {
      return null;
    }

    return mostRecentPost;
  }

  async createPosts(data: { body: string; time: Date; sentTime: Date | null }[]) {
    return this.prisma.post.createMany({ data });
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
