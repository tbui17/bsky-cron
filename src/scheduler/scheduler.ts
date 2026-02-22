import { DbClient } from "../db/db-client";
import { BlueskyClient } from "../bluesky/client";
import { logger } from "../logger";

export class Scheduler {
  constructor(
    private dbClient: DbClient,
    private blueskyClient: BlueskyClient,
  ) {}

  getNextPost() {
    return this.dbClient.getNextPost();
  }

  /**
   * Main orchestration method.
   * Returns the sent post, or null if no post was sent.
   */
  async run() {
    logger.info("Starting scheduler run");

    try {
      const scheduledPost = await this.getNextPost();

      if (!scheduledPost.isReadyToSend()) {
        logger.info(scheduledPost.getStatusMessage());
        return null;
      }

      const post = scheduledPost.getPost();
      logger.info({ id: post.id, body: post.body, time: post.time }, "Found post to send");

      const response = await this.blueskyClient.post(post.body);
      await this.dbClient.markPostAsSent(post.id);

      logger.info({ post, response }, "Successfully posted to Bluesky");

      return post;
    } catch (error) {
      logger.error(error, "Error in scheduler");
      throw error;
    }
  }
}
