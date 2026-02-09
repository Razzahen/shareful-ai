CREATE TYPE "public"."ai_provider" AS ENUM('claude', 'gpt', 'gemini');--> statement-breakpoint
CREATE TYPE "public"."solution_type" AS ENUM('fix', 'workaround', 'pattern', 'reference', 'config');--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(128) NOT NULL,
	"period" varchar(32) NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_id" integer NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" varchar(128) NOT NULL,
	"repo" varchar(128) NOT NULL,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_tags" (
	"share_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "share_tags_share_id_tag_id_pk" PRIMARY KEY("share_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner" varchar(128) NOT NULL,
	"repo" varchar(128) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"problem" varchar(256) NOT NULL,
	"solution_type" "solution_type" NOT NULL,
	"content" text NOT NULL,
	"url" text NOT NULL,
	"verified" integer DEFAULT 0 NOT NULL,
	"ai_provider" "ai_provider",
	"environment" jsonb,
	"related" jsonb,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"indexed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"search_vector" text DEFAULT ''::tsvector
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"share_id" integer NOT NULL,
	"github_user" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_tags" ADD CONSTRAINT "share_tags_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_tags" ADD CONSTRAINT "share_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifications" ADD CONSTRAINT "verifications_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "leaderboard_entries_username_period_idx" ON "leaderboard_entries" USING btree ("username","period");--> statement-breakpoint
CREATE INDEX "leaderboard_entries_period_score_idx" ON "leaderboard_entries" USING btree ("period","score");--> statement-breakpoint
CREATE UNIQUE INDEX "outcomes_share_id_idx" ON "outcomes" USING btree ("share_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repos_owner_repo_idx" ON "repos" USING btree ("owner","repo");--> statement-breakpoint
CREATE INDEX "share_tags_tag_id_idx" ON "share_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_owner_repo_slug_idx" ON "shares" USING btree ("owner","repo","slug");--> statement-breakpoint
CREATE INDEX "shares_owner_idx" ON "shares" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "shares_solution_type_idx" ON "shares" USING btree ("solution_type");--> statement-breakpoint
CREATE INDEX "shares_created_at_idx" ON "shares" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "verifications_share_user_idx" ON "verifications" USING btree ("share_id","github_user");--> statement-breakpoint
CREATE INDEX "verifications_share_id_idx" ON "verifications" USING btree ("share_id");