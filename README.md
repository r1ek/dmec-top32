# Salajase Pleistaühingu DMEC

Tournament management application for organizing multi-stage championships with real-time spectator viewing.

## Features

- **Season Management**: Track standings across multiple competitions
- **Qualification Rounds**: Score-based qualification with automatic ranking
- **Tournament Brackets**: Auto-generated seeded brackets with third-place match
- **Live View**: Real-time spectator mode with instant updates
- **Self-Registration**: Participants can register via shared link

## Tech Stack

- React 19 + TypeScript
- Vite
- Convex (real-time database)
- TailwindCSS

## Run Locally

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Start Convex dev server (first time: creates project)
npx convex dev

# In another terminal, start the app
npm run dev
```

The app runs at `http://localhost:5173`

## Environment Variables

Create `.env.local` with:

```env
CONVEX_DEPLOYMENT=dev:your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud
```

These are auto-generated when you run `npx convex dev` for the first time.

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Set environment variable: `VITE_CONVEX_URL` = your Convex production URL
4. Deploy

### Backend (Convex)

```bash
# Deploy to production
npx convex deploy
```

### Auto-Deploy

Vercel auto-deploys on push to `main`. For Convex, add to your CI:

```yaml
- run: npx convex deploy
  env:
    CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

Get your deploy key from [Convex dashboard](https://dashboard.convex.dev) → Project Settings → Deploy Key.

## URL Modes

| URL | Mode |
|-----|------|
| `/` | Admin interface |
| `/?session=<id>` | Participant registration |
| `/?live=<id>` | Spectator view (real-time) |

## License

Private project.
