import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Participant validator (used in qualification and bracket)
const participantValidator = v.object({
  id: v.number(),
  name: v.string(),
  score: v.union(v.number(), v.null()),
  seed: v.number(),
});

// Championship standing validator
const standingValidator = v.object({
  id: v.number(),
  name: v.string(),
  pointsPerCompetition: v.array(v.number()),
});

// Match validator for bracket
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
    adminSecret: v.string(),
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

  // Separate table for registrations (real-time participant signups)
  registrations: defineTable({
    sessionId: v.string(),
    participantId: v.number(),
    name: v.string(),
    createdAt: v.number(),
    processed: v.boolean(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_sessionId_unprocessed", ["sessionId", "processed"]),
});
