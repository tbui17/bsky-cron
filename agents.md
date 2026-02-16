# Agents.md - Project Documentation for Opencode

## Project Overview
Bluesky cron job that posts random number greetings to Bluesky every 5 minutes via GitHub Actions.

## Tech Stack
- **Runtime**: Bun
- **Language**: TypeScript
- **API**: @atproto/api (Bluesky SDK)
- **Database**: Supabase (stores social media posts)
- **CLI**: Supabase CLI
- **CI/CD**: GitHub Actions

## Environment Variables
Required in `.env` or GitHub Secrets:
- `BLUESKY_HANDLE` - Bluesky handle (e.g., tbui18.bsky.social)
- `BLUESKY_PASSWORD` - Bluesky app password

## Commands
```bash
# Install dependencies
bun install

# Run locally
bun run post

# Dispatch workflow via CLI
gh workflow run cron.yml
```

## Project Structure
```
├── .github/workflows/
│   └── cron.yml          # GHA cron workflow (every 5 min)
├── src/
│   └── post.ts           # Main posting script
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── README.md             # User documentation
```

## Key Files
- `src/post.ts` - Uses BskyAgent to login and post random numbers
- `.github/workflows/cron.yml` - Scheduled workflow using cron

## Rate Limits
Bluesky allows 1,666 posts/hour, 11,666/day. This cron posts 288/day (every 5 min).

## Important Notes
- GitHub Actions cron is "best-effort" - jobs may be delayed by hours
- Never commit `.env` with real credentials
- Use `gh secret set` to configure repo secrets
