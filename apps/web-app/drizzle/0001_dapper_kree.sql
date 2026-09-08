CREATE TABLE "ai_usage_counters" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_counters_user_provider_pk" PRIMARY KEY("user_id","provider"),
	CONSTRAINT "ai_usage_counters_message_count_check" CHECK ("ai_usage_counters"."message_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;