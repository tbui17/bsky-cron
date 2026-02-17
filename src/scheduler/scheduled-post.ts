import type { Post } from "../../prisma/generated/client";

export class ScheduledPost {
  private post: Post | null;
  private now: Date;

  constructor(post: Post | null, now: Date) {
    this.post = post;
    this.now = now;
  }

  hasPost(): boolean {
    return this.post !== null;
  }

  isReadyToSend(): boolean {
    if (!this.post) return false;
    return this.post.sentTime === null && this.post.time <= this.now;
  }

  isAlreadySent(): boolean {
    if (!this.post) return false;
    return this.post.sentTime !== null;
  }

  getTimeUntil(): number {
    if (!this.post) throw new Error("No post available");
    return this.post.time.getTime() - this.now.getTime();
  }

  getTimeSince(): number {
    if (!this.post) throw new Error("No post available");
    return this.now.getTime() - this.post.time.getTime();
  }

  getBody(): string {
    if (!this.post) throw new Error("No post available");
    return this.post.body;
  }

  getPost(): Post {
    if (!this.post) throw new Error("No post available");
    return this.post;
  }

  getStatusMessage(): string {
    if (!this.post) {
      return "No posts scheduled in database";
    }

    if (this.isAlreadySent()) {
      const timeSince = this.formatDuration(this.getTimeSince());
      return `Post already sent ${timeSince} ago. No upcoming posts scheduled`;
    }

    const timeUntil = this.getTimeUntil();
    if (timeUntil > 0) {
      const formatted = this.formatDuration(timeUntil);
      return `Next post scheduled in ${formatted}`;
    }

    return "Post is ready to send";
  }

  private formatDuration(ms: number): string {
    const absMs = Math.abs(ms);
    const hours = Math.floor(absMs / (1000 * 60 * 60));
    const minutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }
}
