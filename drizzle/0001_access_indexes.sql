CREATE INDEX IF NOT EXISTS schedules_user_time_idx ON schedules(user_id, starts_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS schedules_status_idx ON schedules(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_user_type_idx ON events(user_id, type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS events_type_page_idx ON events(type, page);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS books_object_key_idx ON books(object_key);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS users_created_idx ON users(created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS errors_created_idx ON errors(created_at);
