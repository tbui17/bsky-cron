# Bluesky Cron Post

A TypeScript script using Bun that posts scheduled messages to Bluesky from a PostgreSQL database via GitHub Actions.

Posts are made to: [https://bsky.app/profile/tbui18.bsky.social](https://bsky.app/profile/tbui18.bsky.social)

## Features

- Reads posts from Supabase/PostgreSQL database with scheduled times
- Posts only the most recent past-due unsent message
- Updates database with sent timestamp on success
- Structured logging with Pino
- Integration tests with Bun's test runner
- Local development with Supabase CLI and Docker

## Prerequisites

- [Bun](https://bun.sh/) installed locally
- [Docker](https://www.docker.com/) for local Supabase
- Bluesky account with app password
- Supabase account (for hosted database)

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/your-username/bsky-cron.git
cd bsky-cron
bun install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
BLUESKY_HANDLE=your-handle.bsky.social
BLUESKY_PASSWORD=your-app-password
DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
```

### 3. Database Setup

#### Local Development (with Supabase CLI)

```bash
# Start local Supabase
bun run supabase:start

# Generate Prisma client
bun run prisma:generate

# Push schema to local database (uses DATABASE_URL from .env)
bun run prisma:push

# Seed with data from data.csv
bun run db:seed
```

#### Hosted Database (Production)

```bash
# Push schema to hosted Supabase
bun run prisma:push

# Seed hosted database
bun run db:seed
```

### 4. Generate Bluesky App Password

1. Go to Bluesky Settings → App Passwords
2. Generate a new app password
3. Add to `.env` as `BLUESKY_PASSWORD`

## Usage

### Run Locally

```bash
# Run the scheduler (checks for and sends next post)
bun run post

# Or using the dev script
bun run dev
```

### GitHub Actions

The cron workflow runs every 30 minutes automatically. You can also trigger manually:

```bash
gh workflow run cron.yml
```

## Database Schema

```prisma
model Post {
  id        Int       @id @default(autoincrement())
  createdAt DateTime  @default(now()) @map("created_at")
  body      String    @default("") @db.Text
  time      DateTime  @unique
  sentTime  DateTime? @map("sent_time")

  @@map("post")
}
```

- `body`: The message content to post
- `time`: When the post should be sent
- `sentTime`: When it was actually sent (null = not sent yet)

## How It Works

The scheduler:
1. Queries for the most recent post where `time <= NOW()` AND `sentTime IS NULL`
2. If found, posts to Bluesky
3. Updates `sentTime` on success
4. If no posts are ready, exits silently

**Example:** Given current time is 6:00 AM:
- 2:00 AM post (not sent) → **NOT sent** (not the most recent)
- 4:00 AM post (sent) → Skipped
- 8:00 AM post (not sent) → **NOT eligible** (in the future)
- 5:00 AM post (not sent) → **SENT** (most recent past post)

## Scripts

```bash
# Development
bun run dev                # Run scheduler
bun run test               # Run integration tests
```

## Testing

Run integration tests against local Supabase:

```bash
# Ensure local Supabase is running
bun run supabase:start

# Set local database URL in .env
DB_CONNECTION=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Run tests
bun run test
```

**Note:** The Bluesky integration tests will post actual messages to your account.

## Rate Limits

Bluesky API limits:
- **Create Posts:** 1,666/hour, 11,666/day
- **This cron:** 48 posts/day (every 30 minutes)

We're well within safe limits. The script exits with code 1 on failure, triggering GHA notifications.

## GitHub Actions Cron Disclaimer

**⚠️** GitHub Actions cron is "best-effort" - jobs may be delayed by hours. For predictable timing, consider:
- External cron service triggering workflow dispatches
- Self-hosting on a server

## Project Structure

```
bsky-cron/
├── .github/workflows/
│   └── cron.yml          # GHA workflow
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── generated/        # Generated Prisma client
├── src/
│   ├── index.ts          # Entry point
│   ├── db/
│   │   ├── client.ts     # Prisma client singleton
│   │   ├── db-client.ts  # DbClient class
│   │   └── client-factory.ts # Prisma client factory
│   ├── bluesky/
│   │   └── client.ts     # Bluesky API client
│   ├── scheduler/
│   │   ├── runner.ts     # Core scheduling logic
│   │   └── date-provider.ts # DateTimeProvider interface
│   ├── logger.ts         # Pino logger setup
│   └── __tests__/
│       ├── db.test.ts    # Database tests
│       ├── bluesky.test.ts # Bluesky API tests
│       └── smoke.test.ts # Production DB smoke test
├── .env.example          # Env template
└── package.json          # Scripts & dependencies
```

## License

MIT
