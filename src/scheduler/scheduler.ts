import type { Post } from "../../prisma/generated/client";
import type { DbClientInterface, BlueskyClientInterface } from "../types";
import { logger } from "../logger";

export class Scheduler {
  constructor(
    private dbClient: DbClientInterface,
    private blueskyClient: BlueskyClientInterface,
  ) {}

  /**
   * Main orchestration method.
   * Returns the sent post, or null if no post was sent.
   */
  async run(): Promise<Post | null> {
    logger.info("Starting scheduler run");

    try {
      const scheduledPost = await this.dbClient.getNextPostToSend();

      if (!scheduledPost.isReadyToSend) {
        logger.info(scheduledPost.getStatusMessage());
        return null;
      }

      const post = scheduledPost.getPost();
      logger.info({ postId: post.id, time: post.time }, "Found post to send");

      const response = await this.blueskyClient.post(post.body);
      await this.dbClient.markPostAsSent(post.id);

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
