import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate simple random ID
const generateSecret = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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

// Get full session with admin secret (for admin verification)
export const getSessionWithSecret = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

// Get pending registrations
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

// ============ MUTATIONS ============

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

    const adminSecret = generateSecret();

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
      standings: v.array(v.object({
        id: v.number(),
        name: v.string(),
        pointsPerCompetition: v.array(v.number()),
      })),
      competitionParticipants: v.array(v.object({
        id: v.number(),
        name: v.string(),
        score: v.union(v.number(), v.null()),
        seed: v.number(),
      })),
      bracket: v.array(v.array(v.object({
        id: v.number(),
        roundIndex: v.number(),
        matchIndex: v.number(),
        participant1: v.union(v.object({
          id: v.number(),
          name: v.string(),
          score: v.union(v.number(), v.null()),
          seed: v.number(),
        }), v.null()),
        participant2: v.union(v.object({
          id: v.number(),
          name: v.string(),
          score: v.union(v.number(), v.null()),
          seed: v.number(),
        }), v.null()),
        winner: v.union(v.object({
          id: v.number(),
          name: v.string(),
          score: v.union(v.number(), v.null()),
          seed: v.number(),
        }), v.null()),
        nextMatchId: v.union(v.number(), v.null()),
      }))),
      thirdPlaceMatch: v.union(v.object({
        id: v.number(),
        roundIndex: v.number(),
        matchIndex: v.number(),
        participant1: v.union(v.object({
          id: v.number(),
          name: v.string(),
          score: v.union(v.number(), v.null()),
          seed: v.number(),
        }), v.null()),
        participant2: v.union(v.object({
          id: v.number(),
          name: v.string(),
          score: v.union(v.number(), v.null()),
          seed: v.number(),
        }), v.null()),
        winner: v.union(v.object({
          id: v.number(),
          name: v.string(),
          score: v.union(v.number(), v.null()),
          seed: v.number(),
        }), v.null()),
        nextMatchId: v.union(v.number(), v.null()),
      }), v.null()),
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
      (p) => p.name.toLowerCase() === nameLower
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

    const participantId = Date.now();

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
    if (session.standings.some((p) => p.name.toLowerCase() === nameLower)) {
      throw new Error("See nimi on juba olemas");
    }

    const newStanding = {
      id: Date.now(),
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
    participantId: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) throw new Error("Session not found");
    if (session.adminSecret !== args.adminSecret) throw new Error("Unauthorized");

    await ctx.db.patch(session._id, {
      standings: session.standings.filter((p) => p.id !== args.participantId),
      updatedAt: Date.now(),
    });
  },
});
