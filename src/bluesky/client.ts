import { AtpAgent } from "@atproto/api";

export interface Credentials {
  handle: string;
  password: string;
}

const DEFAULT_TIMEOUT_MS = 30_000; // 30 seconds

export class BlueskyClient {
  private agent: AtpAgent;
  private isLoggedIn = false;
  private credentials: Credentials;
  private timeoutMs: number;

  private constructor(credentials: Credentials, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.credentials = credentials;
    this.timeoutMs = timeoutMs;
    this.agent = new AtpAgent({
      service: "https://bsky.social",
    });
  }

  static createDefault(): BlueskyClient {
    const handle = process.env.BLUESKY_HANDLE;
    const password = process.env.BLUESKY_PASSWORD;

    if (!handle || !password) {
      throw new Error("BLUESKY_HANDLE and BLUESKY_PASSWORD must be set");
    }

    return new BlueskyClient({ handle, password });
  }

  static create(credentials: Credentials, timeoutMs?: number): BlueskyClient {
    return new BlueskyClient(credentials, timeoutMs);
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${this.timeoutMs}ms`)), this.timeoutMs)
    );
    return Promise.race([promise, timeout]);
  }

  async login(): Promise<void> {
    if (this.isLoggedIn) return;

    await this.withTimeout(
      this.agent.login({
        identifier: this.credentials.handle,
        password: this.credentials.password,
      })
    );

    this.isLoggedIn = true;
  }

  async post(text: string): Promise<{ uri: string; cid: string }> {
    await this.login();

    if (!text || text.trim().length === 0) {
      throw new Error("Post text cannot be empty");
    }

    if (text.length > 300) {
      throw new Error("Post text exceeds 300 character limit");
    }

    const response = await this.withTimeout(
      this.agent.post({
        text: text.trim(),
      })
    );

    return {
      uri: response.uri,
      cid: response.cid,
    };
  }

  get IsLoggedIn(): boolean {
    return this.isLoggedIn;
  }
}
