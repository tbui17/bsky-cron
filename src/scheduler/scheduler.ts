import type { Post } from "../../prisma/generated/client";
import type { ScheduledPost } from "./scheduled-post";
import type {
  BlueskyPostResult,
  DbClientInterface,
  BlueskyClientInterface,
} from "../types";
import { logger } from "../logger";

export class Scheduler {
  constructor(
    private dbClient: DbClientInterface,
    private blueskyClient: BlueskyClientInterface,
  ) {}

  /**
   * Gets the next post to consider for sending.
   * Returns a ScheduledPost domain object that encapsulates post state.
   */
  async getNextPost(): Promise<ScheduledPost> {
    return this.dbClient.getNextPostToSend();
  }

  /**
   * Determines if a post should be sent based on its state.
   * Pure function - no side effects.
   */
  shouldSendPost(scheduledPost: ScheduledPost): boolean {
    return scheduledPost.isReadyToSend();
  }

  /**
   * Gets a status message for logging purposes.
   * Pure function - no side effects.
   */
  getStatusMessage(scheduledPost: ScheduledPost): string {
    return scheduledPost.getStatusMessage();
  }

  /**
   * Marks a post as sent in the database.
   */
  async markAsSent(postId: number): Promise<void> {
    await this.dbClient.markPostAsSent(postId);
  }

  /**
   * Main orchestration method.
   * Returns the sent post, or null if no post was sent.
   */
  async run(): Promise<Post | null> {
    logger.info("Starting scheduler run");

    try {
      const scheduledPost = await this.getNextPost();

      if (!this.shouldSendPost(scheduledPost)) {
        logger.info(this.getStatusMessage(scheduledPost));
        return null;
      }

      const post = scheduledPost.getPost();
      logger.info({ postId: post.id, time: post.time }, "Found post to send");

      const response = await this.blueskyClient.post(post.body);
      await this.markAsSent(post.id);

      logger.info(
        {
          postId: post.id,
          uri: response.uri,
          body: post.body,
        },
        "Successfully posted to Bluesky",
      );

      return post;
    } catch (error) {
      logger.error(error, "Error in scheduler");
      throw error;
    }
  }
}
