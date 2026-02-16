import { getNextPostToSend, markPostAsSent } from "../db/posts";
import { postToBluesky } from "../bluesky/client";
import { logger } from "../logger";

export async function runScheduler() {
  logger.info("Starting scheduler run");

  try {
    const post = await getNextPostToSend();

    if (!post) {
      logger.info("No posts ready to send");
      return;
    }

    logger.info({ postId: post.id, time: post.time }, "Found post to send");

    const response = await postToBluesky(post.body);
    
    await markPostAsSent(post.id);
    
    logger.info({ 
      postId: post.id, 
      uri: response.uri,
      body: post.body 
    }, "Successfully posted to Bluesky");

  } catch (error) {
    logger.error(error, "Error in scheduler");
    throw error;
  }
}
