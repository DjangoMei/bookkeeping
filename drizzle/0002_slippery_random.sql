ALTER TABLE `ledger_entries` ADD `payer` text DEFAULT 'family' NOT NULL;--> statement-breakpoint
UPDATE `ledger_entries`
SET `payer` = 'mother'
WHERE `kind` = 'child_expense' AND `detail` LIKE '%妈妈%';
