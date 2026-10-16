ALTER TABLE `bills` ADD `request_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bills_request_key_unique` ON `bills` (`request_key`);