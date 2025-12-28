# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tournament management application for organizing multi-stage championships with real-time spectator viewing. Supports qualification rounds, tournament brackets, and season-long standings tracking.

**Tech Stack:** React 19 + TypeScript + Vite + Convex + TailwindCSS (CDN)

## Development Commands

```bash
npm install                # Install dependencies
npx convex dev            # Start Convex dev server (run in separate terminal)
npm run dev               # Start Vite development server
npm run build             # Build for production
npm run preview           # Preview production build
npm test                  # Run Playwright E2E tests
```

## Architecture

### State Management

Application state lives in `App.tsx` as a single `AppState` object managed by `useState`. Updates are immutable and use spread operators. The application follows a phase-based state machine pattern:

```typescript
CHAMPIONSHIP_VIEW → QUALIFICATION → BRACKET → FINISHED
```

State is propagated down through props. Admin state syncs to Convex with 500ms debouncing.

### Real-Time Communication via Convex

The application uses Convex for real-time database and pub/sub communication:

1. **Admin → Spectators:** State saved to Convex, subscribers receive instant updates via WebSocket
2. **Participants → Admin:** Registration via Convex mutation, admin receives via subscription
3. **Spectators ← Admin:** Real-time updates via `useQuery` hook (automatic WebSocket subscription)

**Key benefit:** No SSE reconnection logic needed - Convex handles connection management automatically.

### URL-Based Routing (No Router Library)

- No query params → Admin interface (main `App` flow)
- `?session=<id>` → `RegistrationPage` (public participant registration)
- `?live=<id>` → `LiveResultsView` (read-only spectator view)

### Tournament Bracket Algorithm

Located in `handleStartBracket` function in `App.tsx`. Key logic:
- Bracket size: next power of 2 from participant count
- Traditional seeding (1 vs N, 2 vs N-1, etc.)
- Automatic bye advancement for unmatched players
- Third-place match generated after semifinals
- Match linkage via `nextMatchId` for winner propagation

Points system awards qualification points (top 32) and main competition points (1st: 100, 2nd: 88, etc.).

### Key Files

**Frontend:**
- `App.tsx` - Core state management, phase transitions, bracket generation, Convex sync
- `types.ts` - TypeScript interfaces (`Participant`, `Match`, `AppState`, etc.)
- `constants.ts` - Application constants (`AppPhase` enum)
- `index.tsx` - Entry point with ConvexProvider wrapper

**Components:**
- `components/ChampionshipView.tsx` - Season standings and participant management
- `components/QualificationView.tsx` - Qualification round scoring interface
- `components/TournamentBracket.tsx` - Bracket rendering and match updates
- `components/LiveResultsView.tsx` - Read-only live view with real-time Convex subscription
- `components/RegistrationPage.tsx` - Public registration form using Convex mutation

**Convex Backend:**
- `convex/schema.ts` - Database schema (sessions, registrations tables)
- `convex/sessions.ts` - Queries and mutations for session management

### Important Implementation Details

1. **Persistence:** All session state is persisted in Convex. Admin state syncs automatically.

2. **Real-Time Updates:** `LiveResultsView` uses single `useQuery(api.sessions.getSession)` call - Convex handles WebSocket subscription and reconnection automatically.

3. **Admin Authentication:** Sessions have an `adminSecret` generated on creation. Only requests with matching secret can modify state.

4. **Deep Cloning for Nested Updates:** Bracket updates use `JSON.parse(JSON.stringify(bracket))` to ensure immutability when modifying nested match structures.

5. **Session IDs:** Generated client-side as `dmec-${Date.now()}-${random}`.

6. **Bilingual Code:** UI text is in Estonian.

7. **Collapsible Qualification Results:** In live view, qualification table auto-collapses when bracket is displayed.

## Convex Schema

```typescript
// sessions table
{
  sessionId: string,
  adminSecret: string,
  phase: "CHAMPIONSHIP_VIEW" | "QUALIFICATION" | "BRACKET" | "FINISHED",
  standings: Array<{ id, name, pointsPerCompetition }>,
  competitionParticipants: Array<{ id, name, score, seed }>,
  bracket: Array<Array<Match>>,
  thirdPlaceMatch: Match | null,
  totalCompetitions: number | null,
  competitionsHeld: number,
  createdAt: number,
  updatedAt: number,
}

// registrations table (for tracking sign-ups)
{
  sessionId: string,
  participantId: number,
  name: string,
  createdAt: number,
  processed: boolean,
}
```

## Configuration Notes

- **TypeScript:** Target ES2022, JSX transform: react-jsx, strict mode enabled
- **Vite:** Path alias `@/*` maps to project root
- **Convex:** Configured via `.env.local` with `VITE_CONVEX_URL`
- **HTML:** Tailwind loaded from CDN

## Common Patterns

- **Form submissions:** Enter key support throughout
- **State updates:** Always use prev state updater functions: `setState(prev => ({ ...prev, ... }))`
- **Conditional rendering:** Phase-based component switching in `App.tsx`
- **Sorting:** Championship standings sorted by total points (descending)
- **Convex queries:** Use `useQuery` with `"skip"` for conditional fetching
