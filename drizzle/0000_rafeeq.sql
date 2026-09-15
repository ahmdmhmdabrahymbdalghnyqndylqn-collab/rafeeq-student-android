CREATE TABLE `users` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`name` text NOT NULL,`email` text NOT NULL,`password_hash` text NOT NULL,`country` text DEFAULT 'egypt' NOT NULL,`track` text DEFAULT 'science' NOT NULL,`language` text DEFAULT 'ar' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `events` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`type` text NOT NULL,`page` text DEFAULT 'unknown' NOT NULL,`user_id` integer,`meta` text DEFAULT '{}' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE TABLE `errors` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`message` text NOT NULL,`page` text NOT NULL,`severity` text DEFAULT 'medium' NOT NULL,`device` text DEFAULT 'unknown' NOT NULL,`count` integer DEFAULT 1 NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE TABLE `schedules` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`user_id` integer NOT NULL,`subject` text NOT NULL,`title` text NOT NULL,`starts_at` text NOT NULL,`duration` integer DEFAULT 45 NOT NULL,`status` text DEFAULT 'pending' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE TABLE `books` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`title` text NOT NULL,`subject` text DEFAULT 'عام' NOT NULL,`country` text DEFAULT 'egypt' NOT NULL,`object_key` text NOT NULL,`size` integer DEFAULT 0 NOT NULL,`pages` integer DEFAULT 0 NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE TABLE `settings` (`key` text PRIMARY KEY NOT NULL,`value` text NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
