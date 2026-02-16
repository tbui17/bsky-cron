import { prisma } from "./client";
import type { DateTimeProvider } from "../scheduler/date-provider";

export async function getNextPostToSend(dateProvider: DateTimeProvider) {
  const now = dateProvider.now();
  
  // First, check if the most recent scheduled post (by time) is in the past
  const mostRecentPost = await prisma.post.findFirst({
    orderBy: {
      time: "desc",
    },
  });

  // If no posts exist, or the most recent post is in the future, don't send anything
  if (!mostRecentPost || mostRecentPost.time > now) {
    return null;
  }

  // The most recent post is in the past, now check if it has been sent
  // If it has been sent, nothing to do
  if (mostRecentPost.sentTime !== null) {
    return null;
  }

  // Return the most recent post (which is in the past and not sent)
  return mostRecentPost;
}

export async function markPostAsSent(postId: number) {
  return prisma.post.update({
    where: { id: postId },
    data: { sentTime: new Date() },
  });
}

export async function getPostCount() {
  return prisma.post.count();
}

export async function getSentPostCount() {
  return prisma.post.count({
    where: {
      sentTime: {
        not: null,
      },
    },
  });
}
