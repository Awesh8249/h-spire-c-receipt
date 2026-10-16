CREATE TABLE `admins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mobile` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`pin_hash` text,
	`pin_salt` text,
	`recovery_hash` text,
	`recovery_salt` text,
	`invite_hash` text,
	`invite_expires_at` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admins_mobile_unique` ON `admins` (`mobile`);--> statement-breakpoint
CREATE TABLE `login_security` (
	`mobile` text PRIMARY KEY NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`lock_level` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
