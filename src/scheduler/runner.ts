import { db } from "../db/client";
import { postToBluesky } from "../bluesky/client";
import { logger } from "../logger";
import type { DateTimeProvider } from "./date-provider";
import { SystemDateTimeProvider } from "./date-provider";

export async function runScheduler(dateProvider: DateTimeProvider = new SystemDateTimeProvider()) {
  logger.info("Starting scheduler run");

  try {
    const post = await db.getNextPostToSend(dateProvider);

    if (!post) {
      logger.info("No posts ready to send");
      return null;
    }

    logger.info({ postId: post.id, time: post.time }, "Found post to send");

    const response = await postToBluesky(post.body);
    
    await db.markPostAsSent(post.id);
    
    logger.info({ 
      postId: post.id, 
      uri: response.uri,
      body: post.body 
    }, "Successfully posted to Bluesky");

    return post;

  } catch (error) {
    logger.error(error, "Error in scheduler");
    throw error;
  }
}
