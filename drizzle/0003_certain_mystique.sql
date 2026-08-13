CREATE TABLE `family_projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`budget_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT '进行中' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`updated_by_role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`expense_date` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '其他' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`updated_by_role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `family_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `savings_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT '其他' NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`updated_by_role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_project_expenses_project_date` ON `project_expenses` (`project_id`,`expense_date`);
