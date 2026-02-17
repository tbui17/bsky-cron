import { db } from "../db/client";
import { BlueskyClient } from "../bluesky/client";
import { logger } from "../logger";

export async function runScheduler() {
  logger.info("Starting scheduler run");

  try {
    const post = await db.getNextPostToSend();

    if (!post) {
      logger.info("No posts ready to send");
      return null;
    }

    logger.info({ postId: post.id, time: post.time }, "Found post to send");

    const blueskyClient = BlueskyClient.createDefault();
    const response = await blueskyClient.post(post.body);
    
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
