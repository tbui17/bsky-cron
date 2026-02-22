import type { Post } from "../../prisma/generated/client";
import type { PostCreateInput } from "../../prisma/generated/models";
import type { DateTimeProvider } from "../scheduler/date-provider";
import { SystemDateTimeProvider } from "../scheduler/date-provider";
import { ScheduledPost } from "../scheduler/scheduled-post";
import { createPrismaClient } from "./client-factory";

export class DbClient {
  private prisma: ReturnType<typeof createPrismaClient>;
  private dateProvider: DateTimeProvider;

  private constructor(
    prisma: ReturnType<typeof createPrismaClient>,
    dateProvider: DateTimeProvider,
  ) {
    this.prisma = prisma;
    this.dateProvider = dateProvider;
  }

  private static defaultInstance: DbClient | null = null;

  static createDefault(): DbClient {
    if (DbClient.defaultInstance) {
      return DbClient.defaultInstance;
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    const prisma = createPrismaClient(connectionString);
    DbClient.defaultInstance = new DbClient(prisma, new SystemDateTimeProvider());
    return DbClient.defaultInstance;
  }

  static create(
    connectionString: string,
    dateProvider: DateTimeProvider,
  ): DbClient {
    const prisma = createPrismaClient(connectionString);
    return new DbClient(prisma, dateProvider);
  }

  async getNextPost(): Promise<ScheduledPost> {
    const now = this.dateProvider.now();

    const mostRecentPost = await this.prisma.post.findFirst({
      where: {
        time: { lte: now },
      },
      orderBy: { time: "desc" },
      take: 1,
    });

    if (mostRecentPost && mostRecentPost.sentTime === null) {
      return new ScheduledPost(mostRecentPost, now);
    }

    const nextUpcomingPost = await this.prisma.post.findFirst({
      where: {
        time: { gte: now },
        sentTime: null,
      },
      orderBy: { time: "asc" },
      take: 1,
    });

    return new ScheduledPost(nextUpcomingPost, now);
  }

  async createPosts(data: PostCreateInput[]) {
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

  async isPostSent(postId: number) {
    return this.prisma.post
      .findUnique({
        where: { id: postId, sentTime: { not: null } },
        select: { id: true },
      })
      .then((post) => post !== null);
  }

  // Test helper methods
  async createPost(data: PostCreateInput): Promise<Post> {
    return this.prisma.post.create({ data });
  }

  async findPostById(id: number): Promise<Post | null> {
    return this.prisma.post.findUnique({ where: { id } });
  }

  async deleteAllPosts() {
    return this.prisma.post.deleteMany();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
