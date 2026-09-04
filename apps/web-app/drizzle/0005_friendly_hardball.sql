DROP INDEX "files_workspace_table_name_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "files_workspace_table_name_idx" ON "files" USING btree ("workspace_id",lower("table_name"));