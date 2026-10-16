ALTER TABLE `bills` ADD `bill_type` text DEFAULT 'Final Bill' NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `project_ref` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `previous_paid` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `current_received` real DEFAULT 0 NOT NULL;