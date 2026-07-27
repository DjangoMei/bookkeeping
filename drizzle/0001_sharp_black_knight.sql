ALTER TABLE `ledger_entries` ADD `source_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_entries_source_key_unique` ON `ledger_entries` (`source_key`);