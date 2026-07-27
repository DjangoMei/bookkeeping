CREATE TABLE `ledger_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`owner` text DEFAULT 'family' NOT NULL,
	`entry_date` text NOT NULL,
	`month` text,
	`title` text NOT NULL,
	`category` text DEFAULT '其他' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`gift_type` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_by_role` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
