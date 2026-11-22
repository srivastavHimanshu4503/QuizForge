ALTER TABLE `quiz_attempts` ADD `time_limit_minutes` integer;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `tab_switch_count` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `is_timed_out` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `quiz_assignments` ADD `shuffle_questions` integer DEFAULT 1 NOT NULL;