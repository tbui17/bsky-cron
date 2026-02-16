import { prisma } from "./client";

export async function getNextPostToSend() {
  const now = new Date();
  
  const post = await prisma.post.findFirst({
    where: {
      time: {
        lte: now,
      },
      sentTime: null,
    },
    orderBy: {
      time: "desc",
    },
  });

  return post;
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
