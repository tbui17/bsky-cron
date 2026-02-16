# Bluesky Cron Post

A TypeScript script using Bun that posts random number greetings to Bluesky on a schedule via GitHub Actions.

Posts are made to: [https://bsky.app/profile/tbui18.bsky.social](https://bsky.app/profile/tbui18.bsky.social)

## Features

- Posts "Hello X" where X is a random number (1-1000)
- Runs every 5 minutes via GitHub Actions cron job
- Uses environment variables for secure credential management
- Written in TypeScript with Bun runtime

## Prerequisites

- [Bun](https://bun.sh/) installed locally
- Bluesky account
- App password generated from Bluesky Settings

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/bsky-cron.git
   cd bsky-cron
   ```

2. **Install dependencies:**
   ```bash
   bun install
   ```

3. **Configure environment variables:**
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your Bluesky credentials:
   ```
   BLUESKY_HANDLE=your-handle.bsky.social
   BLUESKY_PASSWORD=your-app-password
   ```

4. **Generate App Password:**
   - Go to Bluesky Settings → App Passwords
   - Generate a new app password
   - Copy and paste it into `.env`

## Local Usage

Run the script locally:
```bash
bun run post
```

## GitHub Actions Setup

1. Go to your repository's Settings → Secrets and variables → Actions

2. Add the following repository secrets:
   - `BLUESKY_HANDLE` - Your Bluesky handle (e.g., `your-handle.bsky.social`)
   - `BLUESKY_PASSWORD` - Your Bluesky app password

3. The workflow runs automatically every 5 minutes via cron schedule

4. You can also trigger manually from the Actions tab

## Rate Limits

Bluesky API rate limits:
- **Create Posts:** 1,666/hour, 11,666/day
- **This cron:** 288 posts/day (every 5 minutes)

We're well within safe limits. The script will exit with error code 1 on failure, triggering GitHub Actions notifications.

## Important: GitHub Actions Cron Reliability

**⚠️ Cron Schedule Disclaimer:** GitHub Actions cron schedules are "best-effort" and not guaranteed to run at exact intervals. During periods of high load, GitHub may throttle or delay scheduled workflows significantly - jobs scheduled to run every 5 minutes may be delayed by hours.

This is a known limitation of GitHub's infrastructure. For more predictable timing, consider:
- Using an external cron service to trigger workflow dispatches via the API
- Self-hosting the script on a server with a real cron job
- Accepting that posts may be irregularly spaced

## Project Structure

```
bsky-cron/
├── .github/workflows/
│   └── cron.yml          # GitHub Actions workflow
├── src/
│   └── post.ts           # Main posting script
├── .env.example          # Environment variables template
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## License

MIT
