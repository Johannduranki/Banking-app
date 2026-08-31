CREATE TABLE `accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`balance` real DEFAULT 32480.5 NOT NULL,
	`savings` real DEFAULT 14500 NOT NULL,
	`card_frozen` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`merchant` text NOT NULL,
	`category` text NOT NULL,
	`amount` real NOT NULL,
	`direction` text NOT NULL,
	`created_at` text NOT NULL
);
