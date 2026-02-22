import { DbClient } from "../db/db-client";
import { BlueskyClient } from "../bluesky/client";
import { logger } from "../logger";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

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
      await this.markPostWithRetry(post.id);

      logger.info({ id: post.id, uri: response.uri, cid: response.cid }, "Successfully posted to Bluesky");

      return post;
    } catch (error) {
      logger.error(error, "Error in scheduler");
      throw error;
    }
  }

  /**
   * Retry wrapper for markPostAsSent to prevent duplicate posts.
   * If the post succeeds on Bluesky but marking fails, we'd post duplicates.
   */
  private async markPostWithRetry(postId: number): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.dbClient.markPostAsSent(postId);
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn({ postId, attempt, error: lastError.message }, "Failed to mark post as sent, retrying...");

        if (attempt < MAX_RETRY_ATTEMPTS) {
          await this.delay(RETRY_DELAY_MS * attempt);
        }
      }
    }

    logger.error({ postId, attempts: MAX_RETRY_ATTEMPTS, error: lastError?.message }, "Failed to mark post as sent after all retries");
    throw new Error(`Failed to mark post ${postId} as sent after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
