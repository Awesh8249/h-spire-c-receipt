CREATE TABLE `bills` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`bill_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_mobile` text NOT NULL,
	`work_type` text NOT NULL,
	`work_location` text NOT NULL,
	`quantity` real NOT NULL,
	`rate` real NOT NULL,
	`moram_qty` integer DEFAULT 0 NOT NULL,
	`service_fee` real DEFAULT 499 NOT NULL,
	`total` real NOT NULL,
	`amount_paid` real DEFAULT 0 NOT NULL,
	`balance` real NOT NULL,
	`payment_mode` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bills_bill_number_unique` ON `bills` (`bill_number`);