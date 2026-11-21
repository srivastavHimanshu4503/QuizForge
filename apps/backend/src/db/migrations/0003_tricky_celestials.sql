ALTER TABLE `quizzes` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `is_public` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quizzes` ADD `share_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_share_code_unique` ON `quizzes` (`share_code`);