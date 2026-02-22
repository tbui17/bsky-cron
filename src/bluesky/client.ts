import { AtpAgent } from "@atproto/api";

export interface Credentials {
  handle: string;
  password: string;
}

export class BlueskyClient {
  private agent: AtpAgent;
  private isLoggedIn = false;
  private credentials: Credentials;

  private constructor(credentials: Credentials) {
    this.credentials = credentials;
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

  static create(credentials: Credentials): BlueskyClient {
    return new BlueskyClient(credentials);
  }

  async login(): Promise<void> {
    if (this.isLoggedIn) return;

    await this.agent.login({
      identifier: this.credentials.handle,
      password: this.credentials.password,
    });

    this.isLoggedIn = true;
  }

  async post(text: string): Promise<{ uri: string; cid: string }> {
    await this.login();

    const response = await this.agent.post({
      text,
    });

    return {
      uri: response.uri,
      cid: response.cid,
    };
  }

  get IsLoggedIn(): boolean {
    return this.isLoggedIn;
  }
}
