import type { Post } from "../../prisma/generated/client";
import { BatchPayload } from "../../prisma/generated/internal/prismaNamespace";
import type { ScheduledPost } from "../scheduler/scheduled-post";
/**
 * Input type for creating a new post.
 * Omits auto-generated fields from Prisma's Post type.
 */
export type CreatePostInput = Omit<Post, "id" | "createdAt">;

/**
 * Result type from publishing a post to Bluesky.
 */
export interface BlueskyPostResult {
  uri: string;
  cid: string;
}

/**
 * Interface for Bluesky client operations.
 * Abstracts the Bluesky client for dependency injection.
 */
export interface BlueskyClientInterface {
  post(text: string): Promise<BlueskyPostResult>;
}

/**
 * Interface for database client operations.
 * Abstracts the DbClient for dependency injection.
 */
export interface DbClientInterface {
  getNextPostToSend(): Promise<ScheduledPost>;
  markPostAsSent(postId: number): Promise<Post>;
  createPost(data: CreatePostInput): Promise<Post>;
  createPosts(data: CreatePostInput[]): Promise<BatchPayload>;
  findPostById(id: number): Promise<Post | null>;
  deleteAllPosts(): Promise<BatchPayload>;
  disconnect(): Promise<void>;
}
