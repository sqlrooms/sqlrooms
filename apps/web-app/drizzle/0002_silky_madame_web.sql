CREATE TABLE "file_upload_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"replace_file_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_upload_reservations" ADD CONSTRAINT "file_upload_reservations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "file_upload_reservations_object_key_idx" ON "file_upload_reservations" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "file_upload_reservations_user_expires_at_idx" ON "file_upload_reservations" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_workspace_table_name_idx" ON "files" USING btree ("workspace_id","table_name");