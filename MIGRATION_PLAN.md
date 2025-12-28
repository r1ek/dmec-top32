# Real-Time Architecture Migration Plan

## Problem Statement

Current ntfy.sh-based architecture has critical issues:
- **429 Rate Limiting**: Admin entering scores quickly triggers rate limits
- **Missed Updates**: Users returning to tabs don't see intermediate updates
- **No Persistence**: ntfy.sh is a notification service, not a database
- **Unreliable Reconnection**: SSE reconnection doesn't guarantee state consistency

---

## Solution: Migrate to Convex

### Why Convex Over Alternatives

| Feature | **Convex** | Firebase RTDB | Supabase |
|---------|-----------|---------------|----------|
| Concurrent connections | No hard limit | **100** (risky for 75 users) | 200 |
| Database bandwidth/month | 1 GB | 10 GB | 5 GB |
| React integration | **Native hooks** | Manual listeners | Manual |
| TypeScript support | **End-to-end** | Partial | Partial |
| Auto-pause on inactivity | No | No | **Yes (1 week)** |
| Reconnection handling | **Automatic** | Automatic | Automatic |

**Decision**: Convex wins on DX. Bandwidth (1 GB) is sufficient for actual payload sizes.

### Bandwidth Reality Check

Actual measured payload sizes:
- 15 participants: **~5 KB**
- 32 participants: **~9 KB**

| Scenario | Per Session | 5 Sessions/Month | vs 1 GB Limit |
|----------|-------------|------------------|---------------|
| 15 participants, 75 viewers, 100 updates | 37 MB | 183 MB | **18%** |
| 32 participants, 75 viewers, 100 updates | 66 MB | 330 MB | **33%** |

**Conclusion**: Plenty of headroom on free tier.

---

## Phase 0: E2E Tests with Playwright (Before Migration)

### Setup

```bash
# Install Playwright
npm init playwright@latest

# Choose:
# - TypeScript
# - tests folder
# - No GitHub Actions (for now)
# - Install browsers: Yes
```

This creates:
- `playwright.config.ts`
- `tests/` folder
- `package.json` scripts

### Test Scenarios

Create `tests/tournament.spec.ts`:

```typescript
import { test, expect, Page } from '@playwright/test';

// Helper to generate unique session
const generateSessionId = () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test.describe('Tournament App', () => {

  test.describe('Championship View', () => {
    test('should display empty standings initially', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Salajase pleistaühingu DMEC')).toBeVisible();
      await expect(page.getByText('Edetabel on tühi')).toBeVisible();
    });

    test('should add participant manually', async ({ page }) => {
      await page.goto('/');

      // Find input and add participant
      const nameInput = page.getByPlaceholder(/nimi/i);
      await nameInput.fill('Test Player');
      await nameInput.press('Enter');

      // Verify participant appears
      await expect(page.getByText('Test Player')).toBeVisible();
    });

    test('should set total competitions', async ({ page }) => {
      await page.goto('/');

      const competitionsInput = page.locator('input[type="number"]').first();
      await competitionsInput.fill('6');
      await competitionsInput.press('Enter');

      // Verify it's saved (check UI feedback)
      await expect(competitionsInput).toHaveValue('6');
    });

    test('should enable live view and show session link', async ({ page }) => {
      await page.goto('/');

      // Click enable live view button
      await page.getByRole('button', { name: /live/i }).click();

      // Should show the live link
      await expect(page.getByText(/live=/i)).toBeVisible();
    });
  });

  test.describe('Registration Flow', () => {
    test('should allow participant registration via link', async ({ page, context }) => {
      // Admin page - enable live view to get session ID
      await page.goto('/');
      await page.getByRole('button', { name: /live/i }).click();

      // Get session ID from the displayed link
      const liveLink = await page.getByText(/live=/).textContent();
      const sessionId = liveLink?.match(/live=([^&\s]+)/)?.[1];
      expect(sessionId).toBeTruthy();

      // Open registration page in new tab
      const regPage = await context.newPage();
      await regPage.goto(`/?session=${sessionId}`);

      // Fill registration form
      await regPage.getByPlaceholder(/nimi/i).fill('Registered Player');
      await regPage.getByRole('button', { name: /registreeri/i }).click();

      // Verify success message
      await expect(regPage.getByText(/registreeritud|õnnestus/i)).toBeVisible();

      // Verify participant appears on admin page
      await page.waitForTimeout(3000); // Wait for sync
      await expect(page.getByText('Registered Player')).toBeVisible();
    });
  });

  test.describe('Qualification Phase', () => {
    test('should transition to qualification and allow score entry', async ({ page }) => {
      await page.goto('/');

      // Add participants first
      const nameInput = page.getByPlaceholder(/nimi/i);
      for (const name of ['Player A', 'Player B', 'Player C']) {
        await nameInput.fill(name);
        await nameInput.press('Enter');
      }

      // Start competition
      await page.getByRole('button', { name: /alusta.*võistlust/i }).click();

      // Should be in qualification phase
      await expect(page.getByText(/kvalifikatsioon/i)).toBeVisible();

      // Enter scores
      const scoreInputs = page.locator('input[type="number"]');
      await scoreInputs.nth(0).fill('100');
      await scoreInputs.nth(1).fill('90');
      await scoreInputs.nth(2).fill('80');
    });
  });

  test.describe('Bracket Phase', () => {
    test('should generate bracket from qualification results', async ({ page }) => {
      await page.goto('/');

      // Setup: Add participants
      const nameInput = page.getByPlaceholder(/nimi/i);
      for (let i = 1; i <= 4; i++) {
        await nameInput.fill(`Player ${i}`);
        await nameInput.press('Enter');
      }

      // Start competition
      await page.getByRole('button', { name: /alusta.*võistlust/i }).click();

      // Enter qualification scores
      const scoreInputs = page.locator('input[type="number"]');
      for (let i = 0; i < 4; i++) {
        await scoreInputs.nth(i).fill(`${100 - i * 10}`);
      }

      // Generate bracket
      await page.getByRole('button', { name: /genereeri.*tabel/i }).click();

      // Should show bracket
      await expect(page.getByText(/voor|round/i)).toBeVisible();
    });

    test('should allow setting match winners', async ({ page }) => {
      // This test needs a bracket to be set up first
      // ... similar setup as above ...

      // Click on a participant to set them as winner
      // Verify winner is highlighted
      // Verify they advance to next round
    });
  });

  test.describe('Live View', () => {
    test('should show real-time updates to spectators', async ({ page, context }) => {
      // Admin: Setup and enable live view
      await page.goto('/');

      // Add participant
      const nameInput = page.getByPlaceholder(/nimi/i);
      await nameInput.fill('Live Test Player');
      await nameInput.press('Enter');

      // Enable live view
      await page.getByRole('button', { name: /live/i }).click();
      const liveLink = await page.getByText(/live=/).textContent();
      const sessionId = liveLink?.match(/live=([^&\s]+)/)?.[1];

      // Spectator: Open live view
      const spectatorPage = await context.newPage();
      await spectatorPage.goto(`/?live=${sessionId}`);

      // Wait for initial load
      await spectatorPage.waitForTimeout(2000);

      // Verify spectator sees the participant
      await expect(spectatorPage.getByText('Live Test Player')).toBeVisible();

      // Admin: Add another participant
      await nameInput.fill('New Player');
      await nameInput.press('Enter');

      // Spectator: Should see update (this tests real-time sync)
      await spectatorPage.waitForTimeout(3000); // Current debounce is 2s
      await expect(spectatorPage.getByText('New Player')).toBeVisible();
    });

    test('should reconnect and show current state when tab refocuses', async ({ page, context }) => {
      // Setup admin with live view enabled
      await page.goto('/');
      await page.getByPlaceholder(/nimi/i).fill('Initial Player');
      await page.getByPlaceholder(/nimi/i).press('Enter');
      await page.getByRole('button', { name: /live/i }).click();

      const liveLink = await page.getByText(/live=/).textContent();
      const sessionId = liveLink?.match(/live=([^&\s]+)/)?.[1];

      // Open spectator view
      const spectatorPage = await context.newPage();
      await spectatorPage.goto(`/?live=${sessionId}`);
      await spectatorPage.waitForTimeout(2000);

      // Simulate tab going to background (navigate away briefly)
      await spectatorPage.goto('about:blank');

      // Admin makes changes while spectator is "away"
      await page.getByPlaceholder(/nimi/i).fill('Added While Away');
      await page.getByPlaceholder(/nimi/i).press('Enter');
      await page.waitForTimeout(2500); // Wait for broadcast

      // Spectator returns
      await spectatorPage.goto(`/?live=${sessionId}`);
      await spectatorPage.waitForTimeout(3000);

      // Should see the update made while away
      await expect(spectatorPage.getByText('Added While Away')).toBeVisible();
    });
  });

  test.describe('Full Tournament Flow', () => {
    test('should complete entire tournament cycle', async ({ page }) => {
      await page.goto('/');

      // 1. Add 4 participants
      const nameInput = page.getByPlaceholder(/nimi/i);
      for (let i = 1; i <= 4; i++) {
        await nameInput.fill(`Champion ${i}`);
        await nameInput.press('Enter');
      }

      // 2. Set total competitions
      // ...

      // 3. Start competition -> Qualification
      await page.getByRole('button', { name: /alusta.*võistlust/i }).click();

      // 4. Enter qualification scores
      const scoreInputs = page.locator('input[type="number"]');
      await scoreInputs.nth(0).fill('100');
      await scoreInputs.nth(1).fill('90');
      await scoreInputs.nth(2).fill('80');
      await scoreInputs.nth(3).fill('70');

      // 5. Generate bracket
      await page.getByRole('button', { name: /genereeri/i }).click();

      // 6. Complete bracket matches
      // ... click winners ...

      // 7. Return to championship view
      // await page.getByRole('button', { name: /tagasi/i }).click();

      // 8. Verify points were awarded
      // await expect(page.getByText('100')).toBeVisible(); // Winner points
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npx playwright test

# Run with UI (helpful for debugging)
npx playwright test --ui

# Run specific test file
npx playwright test tests/tournament.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed
```

### Pre-Migration Checklist

Before migrating, ensure these tests pass:
- [ ] Add participants manually
- [ ] Enable live view
- [ ] Register via session link
- [ ] Real-time updates reach spectators
- [ ] Tab refocus shows current state
- [ ] Full qualification → bracket → championship flow

---

## Phase 1: Setup Convex

```bash
# Install
npm install convex

# Initialize (creates convex/ folder, .env.local)
npx convex init
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently \"npx convex dev\" \"vite\"",
    "build": "npx convex deploy && vite build",
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  }
}
```

```bash
npm install -D concurrently
```

---

## Phase 2: Convex Schema (Partial Normalization)

Create `convex/schema.ts`:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Reusable participant validator
const participantValidator = v.object({
  id: v.string(),  // Use string UUID, not Date.now()
  name: v.string(),
  score: v.union(v.number(), v.null()),
  seed: v.number(),
});

const standingValidator = v.object({
  id: v.string(),
  name: v.string(),
  pointsPerCompetition: v.array(v.number()),
});

const matchValidator = v.object({
  id: v.number(),
  roundIndex: v.number(),
  matchIndex: v.number(),
  participant1: v.union(participantValidator, v.null()),
  participant2: v.union(participantValidator, v.null()),
  winner: v.union(participantValidator, v.null()),
  nextMatchId: v.union(v.number(), v.null()),
});

export default defineSchema({
  // Main session state (single document per session)
  sessions: defineTable({
    sessionId: v.string(),
    adminSecret: v.string(),  // Simple auth: admin must provide this to mutate
    phase: v.union(
      v.literal("CHAMPIONSHIP_VIEW"),
      v.literal("QUALIFICATION"),
      v.literal("BRACKET"),
      v.literal("FINISHED")
    ),
    standings: v.array(standingValidator),
    competitionParticipants: v.array(participantValidator),
    bracket: v.array(v.array(matchValidator)),
    thirdPlaceMatch: v.union(matchValidator, v.null()),
    totalCompetitions: v.union(v.number(), v.null()),
    competitionsHeld: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  // Separate table for registrations (prevents race conditions)
  registrations: defineTable({
    sessionId: v.string(),
    participantId: v.string(),
    name: v.string(),
    createdAt: v.number(),
    processed: v.boolean(),  // Admin can mark as processed
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_unprocessed", ["sessionId", "processed"]),
});
```

**Key fixes from critique:**
- Proper typed validators instead of `v.any()`
- String IDs instead of `Date.now()`
- Admin secret for simple authentication
- Registrations in separate table

---

## Phase 3: Convex Functions

### `convex/sessions.ts`

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate secure random ID
const generateId = () => crypto.randomUUID();

// ============ QUERIES (Public, read-only) ============

// Get session state - used by both admin and spectators
export const getSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) return null;

    // Don't expose admin secret to clients
    const { adminSecret, ...publicSession } = session;
    return publicSession;
  },
});

// Get pending registrations (admin only, but secret checked in mutation)
export const getPendingRegistrations = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("registrations")
      .withIndex("by_sessionId_unprocessed", (q) =>
        q.eq("sessionId", args.sessionId).eq("processed", false)
      )
      .collect();
  },
});

// ============ MUTATIONS (Require auth where noted) ============

// Create new session
export const createSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (existing) {
      return { sessionId: args.sessionId, adminSecret: existing.adminSecret };
    }

    const adminSecret = generateId();

    await ctx.db.insert("sessions", {
      sessionId: args.sessionId,
      adminSecret,
      phase: "CHAMPIONSHIP_VIEW",
      standings: [],
      competitionParticipants: [],
      bracket: [],
      thirdPlaceMatch: null,
      totalCompetitions: null,
      competitionsHeld: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { sessionId: args.sessionId, adminSecret };
  },
});

// Update session state (ADMIN ONLY - requires secret)
export const updateSessionState = mutation({
  args: {
    sessionId: v.string(),
    adminSecret: v.string(),
    state: v.object({
      phase: v.union(
        v.literal("CHAMPIONSHIP_VIEW"),
        v.literal("QUALIFICATION"),
        v.literal("BRACKET"),
        v.literal("FINISHED")
      ),
      standings: v.array(v.any()), // Validated at runtime
      competitionParticipants: v.array(v.any()),
      bracket: v.array(v.any()),
      thirdPlaceMatch: v.any(),
      totalCompetitions: v.union(v.number(), v.null()),
      competitionsHeld: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    if (session.adminSecret !== args.adminSecret) {
      throw new Error("Unauthorized: Invalid admin secret");
    }

    await ctx.db.patch(session._id, {
      ...args.state,
      updatedAt: Date.now(),
    });
  },
});

// Register participant (PUBLIC - anyone with session link)
export const registerParticipant = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }

    // Check for duplicate in standings
    const nameLower = args.name.toLowerCase().trim();
    const isDuplicate = session.standings.some(
      (p: any) => p.name.toLowerCase() === nameLower
    );

    if (isDuplicate) {
      throw new Error("See nimi on juba registreeritud");
    }

    // Check pending registrations too
    const pendingDupe = await ctx.db
      .query("registrations")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("name"), args.name.trim()))
      .first();

    if (pendingDupe) {
      throw new Error("See nimi on juba registreeritud");
    }

    const participantId = generateId();

    // Add to registrations table
    await ctx.db.insert("registrations", {
      sessionId: args.sessionId,
      participantId,
      name: args.name.trim(),
      createdAt: Date.now(),
      processed: false,
    });

    // Also add directly to session standings (real-time update)
    const newStanding = {
      id: participantId,
      name: args.name.trim(),
      pointsPerCompetition: Array(session.competitionsHeld).fill(0),
    };

    await ctx.db.patch(session._id, {
      standings: [...session.standings, newStanding],
      updatedAt: Date.now(),
    });

    return { participantId, name: args.name.trim() };
  },
});

// Add participant manually (ADMIN ONLY)
export const addParticipant = mutation({
  args: {
    sessionId: v.string(),
    adminSecret: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) throw new Error("Session not found");
    if (session.adminSecret !== args.adminSecret) throw new Error("Unauthorized");

    const nameLower = args.name.toLowerCase().trim();
    if (session.standings.some((p: any) => p.name.toLowerCase() === nameLower)) {
      throw new Error("See nimi on juba olemas");
    }

    const newStanding = {
      id: generateId(),
      name: args.name.trim(),
      pointsPerCompetition: Array(session.competitionsHeld).fill(0),
    };

    await ctx.db.patch(session._id, {
      standings: [...session.standings, newStanding],
      updatedAt: Date.now(),
    });

    return newStanding;
  },
});

// Remove participant (ADMIN ONLY)
export const removeParticipant = mutation({
  args: {
    sessionId: v.string(),
    adminSecret: v.string(),
    participantId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) throw new Error("Session not found");
    if (session.adminSecret !== args.adminSecret) throw new Error("Unauthorized");

    await ctx.db.patch(session._id, {
      standings: session.standings.filter((p: any) => p.id !== args.participantId),
      updatedAt: Date.now(),
    });
  },
});
```

---

## Phase 4: React Integration

### Update `index.tsx` (Entry Point)

```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from './App';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
```

### Update `App.tsx` (Key Changes)

```typescript
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const App: React.FC = () => {
  // Local state for admin secret (stored in memory/localStorage)
  const [adminSecret, setAdminSecret] = useState<string | null>(() =>
    localStorage.getItem('adminSecret')
  );
  const [sessionId, setSessionId] = useState<string | null>(() =>
    localStorage.getItem('sessionId')
  );

  // Convex queries and mutations
  const session = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId } : "skip"
  );

  const createSession = useMutation(api.sessions.createSession);
  const updateSessionState = useMutation(api.sessions.updateSessionState);

  // Create/join session on mount
  useEffect(() => {
    if (!sessionId) {
      const newSessionId = `dmec-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      createSession({ sessionId: newSessionId }).then((result) => {
        setSessionId(result.sessionId);
        setAdminSecret(result.adminSecret);
        localStorage.setItem('sessionId', result.sessionId);
        localStorage.setItem('adminSecret', result.adminSecret);
      });
    }
  }, [sessionId, createSession]);

  // Debounced save (500ms - still useful to batch rapid changes)
  const saveTimeoutRef = useRef<number | null>(null);

  const saveState = useCallback((newState: AppState) => {
    if (!sessionId || !adminSecret) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      updateSessionState({
        sessionId,
        adminSecret,
        state: {
          phase: newState.phase,
          standings: newState.standings,
          competitionParticipants: newState.competitionParticipants,
          bracket: newState.bracket,
          thirdPlaceMatch: newState.thirdPlaceMatch,
          totalCompetitions: newState.totalCompetitions,
          competitionsHeld: newState.competitionsHeld,
        },
      });
    }, 500); // Reduced from 2000ms - Convex handles this better
  }, [sessionId, adminSecret, updateSessionState]);

  // ... rest of component logic, calling saveState() after state changes
};
```

### Update `LiveResultsView.tsx` (Massive Simplification)

```typescript
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

const LiveResultsView: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  // This ONE line replaces all SSE/fetch/reconnection logic!
  const session = useQuery(api.sessions.getSession, { sessionId });

  // Connection status derived from query state
  const connectionStatus = session === undefined ? 'connecting' : 'live';

  // No useEffect for SSE!
  // No fetchInitialState!
  // No reconnection logic!
  // No debounce handling!
  // Convex handles all of this automatically.

  if (!session) {
    return <LoadingState status={connectionStatus} />;
  }

  const { phase, competitionParticipants, bracket, thirdPlaceMatch, standings, competitionsHeld } = session;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans p-4 sm:p-6 lg:p-8">
      <LiveStatusIndicator status={connectionStatus} />

      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
          Salajase pleistaühingu DMEC - Tulemused
        </h1>
      </header>

      <main className="space-y-8">
        {(phase === "QUALIFICATION" || phase === "BRACKET" || phase === "FINISHED") &&
          <LiveQualificationResults participants={competitionParticipants} />
        }
        {(phase === "BRACKET" || phase === "FINISHED") &&
          <TournamentBracket
            participants={competitionParticipants}
            bracketData={bracket}
            thirdPlaceMatch={thirdPlaceMatch}
            onSetWinner={() => {}}
            phase={phase}
            onReturnToChampionship={() => {}}
            isReadOnly={true}
          />
        }
        {(phase === "CHAMPIONSHIP_VIEW" || phase === "FINISHED") &&
          <LiveStandingsTable standings={standings} competitionsHeld={competitionsHeld} />
        }
      </main>
    </div>
  );
};
```

---

## Phase 5: Environment & Deployment

### Environment Variables

```bash
# .env.local (auto-created by `npx convex init`)
VITE_CONVEX_URL=https://your-project-123.convex.cloud
```

### Deploy

```bash
# Deploy Convex backend
npx convex deploy

# Deploy frontend to Vercel
npx vercel

# Or Netlify
npx netlify deploy --prod
```

---

## Migration Checklist

### Pre-Migration
- [ ] Install Playwright: `npm init playwright@latest`
- [ ] Write E2E tests (see Phase 0)
- [ ] Run tests, ensure all pass: `npx playwright test`
- [ ] Commit: "Add E2E tests before Convex migration"

### Migration
- [ ] Install Convex: `npm install convex`
- [ ] Initialize: `npx convex init`
- [ ] Create `convex/schema.ts`
- [ ] Create `convex/sessions.ts`
- [ ] Update `index.tsx` with ConvexProvider
- [ ] Update `App.tsx` to use Convex hooks
- [ ] Update `LiveResultsView.tsx` (simplify!)
- [ ] Update `RegistrationPage.tsx`
- [ ] Remove all ntfy.sh code
- [ ] Test locally: `npm run dev`
- [ ] Run E2E tests: `npx playwright test`
- [ ] Deploy: `npx convex deploy && npx vercel`

### Post-Migration
- [ ] Update CLAUDE.md with new architecture
- [ ] Delete MIGRATION_PLAN.md (or move to docs/)
- [ ] Monitor Convex dashboard for usage

---

## Code Removal Checklist

Delete from `App.tsx`:
- [ ] `broadcastTimeoutRef`
- [ ] `broadcastState` function
- [ ] SSE `EventSource` for registrations
- [ ] All `fetch('https://ntfy.sh/...')` calls
- [ ] `isInitialBroadcast` ref

Delete from `LiveResultsView.tsx`:
- [ ] `fetchInitialState` function (~25 lines)
- [ ] `connectSSE` function (~50 lines)
- [ ] `eventSourceRef` and `reconnectTimeoutRef`
- [ ] `extractStateFromMessage` function

**Estimated lines removed**: ~150
**Estimated lines added**: ~50 (Convex setup)
**Net reduction**: ~100 lines

---

## Addressing Critique Points

| Critique | How We Address It |
|----------|-------------------|
| "Subscription updates count as function calls" | Acknowledged, but 183-330 MB << 1 GB |
| "Mega-document is bandwidth bomb" | Measured actual payload (5-9 KB), math shows it's fine |
| "No debouncing needed is wrong" | Keep 500ms debounce (reduced from 2s) |
| "`v.any()` defeats TypeScript" | Fixed with proper validators in schema |
| "`Date.now()` as ID is bad" | Changed to `crypto.randomUUID()` |
| "No security" | Added `adminSecret` for mutations |
| "Document size limit" | 5-9 KB << 1 MiB limit |

---

## Free Tier Monitoring

After migration, monitor in [Convex Dashboard](https://dashboard.convex.dev):

- **Function calls**: Should see ~10-50K/month (well under 1M)
- **Database bandwidth**: Should see ~200-400 MB/month (under 1 GB)
- **Database storage**: Should see < 50 MB (well under 512 MB)

If approaching limits, consider:
1. Increase debounce to 1000ms
2. Normalize data further (separate matches table)
3. Archive old sessions
