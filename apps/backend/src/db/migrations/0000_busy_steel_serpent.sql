CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`topic` text NOT NULL,
	`difficulty` text NOT NULL,
	`question_count` integer NOT NULL,
	`ai_model` text DEFAULT 'gemini-2.5-flash' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quizzes_user_id_created_at_idx` ON `quizzes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`question_order` integer NOT NULL,
	`question_text` text NOT NULL,
	`correct_choice_id` text NOT NULL,
	`explanation` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_quiz_id_order_idx` ON `questions` (`quiz_id`,`question_order`);--> statement-breakpoint
CREATE INDEX `questions_quiz_id_idx` ON `questions` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `choices` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`choice_id` text NOT NULL,
	`option_text` text NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `choices_question_id_choice_id_idx` ON `choices` (`question_id`,`choice_id`);--> statement-breakpoint
CREATE INDEX `choices_question_id_idx` ON `choices` (`question_id`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`user_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`shuffled_order` text NOT NULL,
	`score` integer,
	`total_questions` integer NOT NULL,
	`correct_count` integer,
	`incorrect_count` integer,
	`unanswered_count` integer,
	`accuracy_percentage` real,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_quiz_id_attempt_number_idx` ON `quiz_attempts` (`quiz_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `attempts_user_id_completed_at_idx` ON `quiz_attempts` (`user_id`,`completed_at`);--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`selected_choice_id` text,
	`is_correct` integer,
	`answered_at` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `answers_attempt_id_question_id_idx` ON `attempt_answers` (`attempt_id`,`question_id`);--> statement-breakpoint
CREATE INDEX `answers_attempt_id_idx` ON `attempt_answers` (`attempt_id`);