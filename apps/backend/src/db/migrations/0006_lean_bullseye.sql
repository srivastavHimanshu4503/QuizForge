CREATE TABLE `arena_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_choice_id` text NOT NULL,
	`is_correct` integer NOT NULL,
	`response_time_ms` integer NOT NULL,
	`points_awarded` integer NOT NULL,
	`answered_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `arena_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `arena_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arena_answers_session_participant_q_idx` ON `arena_answers` (`session_id`,`participant_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `arena_answers_session_question_idx` ON `arena_answers` (`session_id`,`question_id`);--> statement-breakpoint
CREATE TABLE `arena_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text,
	`nickname` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `arena_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arena_participants_session_nickname_idx` ON `arena_participants` (`session_id`,`nickname`);--> statement-breakpoint
CREATE INDEX `arena_participants_session_id_idx` ON `arena_participants` (`session_id`);--> statement-breakpoint
CREATE TABLE `arena_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`host_id` text NOT NULL,
	`pin` text NOT NULL,
	`status` text DEFAULT 'lobby' NOT NULL,
	`current_question_index` integer DEFAULT 0 NOT NULL,
	`total_questions` integer NOT NULL,
	`time_per_question_seconds` integer DEFAULT 30 NOT NULL,
	`question_started_at` text,
	`created_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`host_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arena_sessions_pin_unique` ON `arena_sessions` (`pin`);--> statement-breakpoint
CREATE UNIQUE INDEX `arena_sessions_pin_idx` ON `arena_sessions` (`pin`);--> statement-breakpoint
CREATE INDEX `arena_sessions_host_id_idx` ON `arena_sessions` (`host_id`);--> statement-breakpoint
CREATE INDEX `arena_sessions_status_idx` ON `arena_sessions` (`status`);