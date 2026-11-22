ALTER TABLE `quizzes` ADD `is_adaptive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `difficulty_tier` text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `difficulty_param` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `questions` ADD `discrimination_param` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `is_adaptive` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `current_theta` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `standard_error` real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `ability_history` text DEFAULT '[]' NOT NULL;