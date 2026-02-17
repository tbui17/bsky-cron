# Agents.md - Project Documentation for Opencode

## Project Overview
Bluesky cron job that posts scheduled messages from a PostgreSQL database to Bluesky every 30 minutes via GitHub Actions.

## Tech Stack
- **Runtime**: Bun
- **Language**: TypeScript
- **API**: @atproto/api (Bluesky SDK)
- **Database**: PostgreSQL via Supabase (stores social media posts with scheduled times)
- **ORM**: Prisma
- **Logging**: Pino with pino-pretty
- **CLI**: Supabase CLI for local development
- **Testing**: Bun's built-in test runner
- **CI/CD**: GitHub Actions

## Environment Variables
Required in `.env` or GitHub Secrets:
- `BLUESKY_HANDLE` - Bluesky handle (e.g., tbui18.bsky.social)
- `BLUESKY_PASSWORD` - Bluesky app password
- `DATABASE_URL` - PostgreSQL connection string

## Commands

### Development
```bash
# Run scheduler locally
bun run dev

# Testing
bun run test
```

### GitHub Actions
```bash
# Dispatch workflow
gh workflow run cron.yml
```

## Project Structure
```
bsky-cron/
├── .github/workflows/
│   └── cron.yml          # GHA cron workflow (every 30 min)
├── prisma/
│   ├── schema.prisma     # Database schema
│   ├── generated/        # Generated Prisma client
│   └── config.ts        # Prisma configuration
├── src/
│   ├── index.ts          # Entry point
│   ├── db/
│   │   ├── client.ts     # Prisma client singleton
│   │   ├── db-client.ts # DbClient class
│   │   └── client-factory.ts # Prisma client factory
│   ├── bluesky/
│   │   └── client.ts    # Bluesky API client
│   ├── scheduler/
│   │   ├── runner.ts    # Core scheduling logic
│   │   └── date-provider.ts # DateTimeProvider
│   ├── logger.ts        # Pino logger configuration
│   └── __tests__/
│       ├── db.test.ts   # Database integration tests
│       ├── bluesky.test.ts # Bluesky API tests
│       └── smoke.test.ts # Production DB smoke test
├── .env.example         # Environment template
├── package.json         # Dependencies and scripts
└── prisma.config.ts     # Prisma configuration
```

## Key Files
- `src/index.ts` - Entry point, calls scheduler
- `src/scheduler/runner.ts` - Core logic: queries DB, posts to Bluesky, updates sent_time
- `src/db/posts.ts` - Database operations
- `prisma/schema.prisma` - Post model: id, created_at, body, time, sent_time
- `.github/workflows/cron.yml` - Scheduled workflow

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

### Logic
- Query: Find most recent post where `time <= NOW()` AND `sent_time IS NULL`
- If found: Post to Bluesky, then update `sent_time` to NOW()
- If not: Exit silently

## Local Development

1. Start Supabase: `bun run supabase:start`
2. Set `DATABASE_URL` to local URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
3. Push schema: `bun run prisma:push`
4. Seed data: `bun run db:seed`
5. Run tests: `bun run test`

## Rate Limits
Bluesky allows 1,666 posts/hour, 11,666/day. This cron posts 48/day (every 30 min).

## Important Notes
- GitHub Actions cron is "best-effort" - jobs may be delayed by hours
- Never commit `.env` with real credentials
- Use `gh secret set` to configure repo secrets
- The scheduler only sends the most recent past-due post (not all overdue posts)
- Bluesky integration tests post to actual account
- Hosted database push requires network access to Supabase
