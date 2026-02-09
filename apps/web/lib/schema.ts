import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// ── Enums ──────────────────────────────────────────────────────

export const solutionTypeEnum = pgEnum("solution_type", [
  "fix",
  "workaround",
  "pattern",
  "reference",
  "config",
]);

export const aiProviderEnum = pgEnum("ai_provider", [
  "claude",
  "gpt",
  "gemini",
]);

// ── Repos ──────────────────────────────────────────────────────

export const repos = pgTable(
  "repos",
  {
    id: serial("id").primaryKey(),
    owner: varchar("owner", { length: 128 }).notNull(),
    repo: varchar("repo", { length: 128 }).notNull(),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    gitSha: varchar("git_sha", { length: 40 }),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    trustScore: integer("trust_score").notNull().default(0),
    ownerVerified: integer("owner_verified").notNull().default(0),
  },
  (table) => [uniqueIndex("repos_owner_repo_idx").on(table.owner, table.repo)]
);

// ── Index Jobs ────────────────────────────────────────────────

export const indexJobs = pgTable(
  "index_jobs",
  {
    id: serial("id").primaryKey(),
    owner: varchar("owner", { length: 128 }).notNull(),
    repo: varchar("repo", { length: 128 }).notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [index("idx_index_jobs_status").on(table.status, table.createdAt)]
);

// ── Index Upstreams ──────────────────────────────────────────

export const indexUpstreams = pgTable(
  "index_upstreams",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    url: text("url").notNull(),
    trustScore: integer("trust_score").notNull().default(50),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    cursor: text("cursor"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
  },
  (table) => [uniqueIndex("index_upstreams_name_idx").on(table.name)]
);

// ── Shares ─────────────────────────────────────────────────────

export const shares = pgTable(
  "shares",
  {
    id: serial("id").primaryKey(),
    owner: varchar("owner", { length: 128 }).notNull(),
    repo: varchar("repo", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 64 }).notNull(),
    title: varchar("title", { length: 128 }).notNull(),
    problem: varchar("problem", { length: 256 }).notNull(),
    solutionType: solutionTypeEnum("solution_type").notNull(),
    content: text("content").notNull(),
    url: text("url").notNull(),
    verified: integer("verified").default(0).notNull(),
    aiProvider: aiProviderEnum("ai_provider"),
    environment: jsonb("environment").$type<{
      language?: string;
      framework?: string;
      version?: string;
    }>(),
    related: jsonb("related").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    viewCount: integer("view_count").notNull().default(0),
    installCount: integer("install_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    indexedBy: varchar("indexed_by", { length: 128 })
      .notNull()
      .default("shareful.ai"),
    searchVector: text("search_vector")
      .$type<unknown>()
      .default(sql`''::tsvector`),
  },
  (table) => [
    uniqueIndex("shares_owner_repo_slug_idx").on(
      table.owner,
      table.repo,
      table.slug
    ),
    index("shares_owner_idx").on(table.owner),
    index("shares_solution_type_idx").on(table.solutionType),
    index("shares_created_at_idx").on(table.createdAt),
    // GIN indexes for FTS + trigram are created in drizzle/0001_setup_fts.sql
    // after pg_trgm extension is enabled and search_vector is cast to tsvector
  ]
);

// ── Tags ───────────────────────────────────────────────────────

export const tags = pgTable(
  "tags",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
  },
  (table) => [
    uniqueIndex("tags_name_idx").on(table.name),
    // GIN trigram index created in drizzle/0001_setup_fts.sql after pg_trgm extension
  ]
);

// ── Share Tags (join table) ────────────────────────────────────

export const shareTags = pgTable(
  "share_tags",
  {
    shareId: integer("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.shareId, table.tagId] }),
    index("share_tags_tag_id_idx").on(table.tagId),
  ]
);

// ── Outcomes ───────────────────────────────────────────────────

export const outcomes = pgTable(
  "outcomes",
  {
    id: serial("id").primaryKey(),
    shareId: integer("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    successCount: integer("success_count").notNull().default(0),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (table) => [uniqueIndex("outcomes_share_id_idx").on(table.shareId)]
);

// ── Verifications ──────────────────────────────────────────────

export const verifications = pgTable(
  "verifications",
  {
    id: serial("id").primaryKey(),
    shareId: integer("share_id")
      .notNull()
      .references(() => shares.id, { onDelete: "cascade" }),
    githubUser: varchar("github_user", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("verifications_share_user_idx").on(
      table.shareId,
      table.githubUser
    ),
    index("verifications_share_id_idx").on(table.shareId),
  ]
);

// ── Leaderboard Entries ───────────────────────────────────────

export const leaderboardEntries = pgTable(
  "leaderboard_entries",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 128 }).notNull(),
    period: varchar("period", { length: 32 }).notNull(),
    score: integer("score").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("leaderboard_entries_username_period_idx").on(
      table.username,
      table.period
    ),
    index("leaderboard_entries_period_score_idx").on(table.period, table.score),
  ]
);

// ── Moderation Actions ───────────────────────────────────────

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: serial("id").primaryKey(),
    targetType: varchar("target_type", { length: 16 }).notNull(),
    targetId: integer("target_id").notNull(),
    action: varchar("action", { length: 16 }).notNull(),
    reason: text("reason"),
    moderator: varchar("moderator", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("moderation_actions_target_idx").on(table.targetType, table.targetId),
  ]
);

// ── Index Events ────────────────────────────────────────────

export const indexEvents = pgTable(
  "index_events",
  {
    id: serial("id").primaryKey(),
    eventType: varchar("event_type", { length: 32 }).notNull(),
    owner: varchar("owner", { length: 128 }).notNull(),
    repo: varchar("repo", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 64 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_index_events_created").on(table.createdAt),
    index("idx_index_events_owner_repo").on(table.owner, table.repo),
  ]
);

// ── Relations ──────────────────────────────────────────────────

export const sharesRelations = relations(shares, ({ many }) => ({
  shareTags: many(shareTags),
  outcomes: many(outcomes),
  verifications: many(verifications),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  shareTags: many(shareTags),
}));

export const shareTagsRelations = relations(shareTags, ({ one }) => ({
  share: one(shares, {
    fields: [shareTags.shareId],
    references: [shares.id],
  }),
  tag: one(tags, {
    fields: [shareTags.tagId],
    references: [tags.id],
  }),
}));

export const outcomesRelations = relations(outcomes, ({ one }) => ({
  share: one(shares, {
    fields: [outcomes.shareId],
    references: [shares.id],
  }),
}));

export const verificationsRelations = relations(verifications, ({ one }) => ({
  share: one(shares, {
    fields: [verifications.shareId],
    references: [shares.id],
  }),
}));
