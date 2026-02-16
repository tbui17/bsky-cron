import { prisma } from "./client";

async function truncate() {
  await prisma.post.deleteMany();
  console.log("Truncated all posts");
  await prisma.$disconnect();
}

truncate();
