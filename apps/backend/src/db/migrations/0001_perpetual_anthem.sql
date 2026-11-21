CREATE TABLE `code_quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`repo_url` text NOT NULL,
	`repo_owner` text NOT NULL,
	`repo_name` text NOT NULL,
	`branch` text DEFAULT 'main' NOT NULL,
	`question_count` integer NOT NULL,
	`llm_provider` text NOT NULL,
	`llm_model` text NOT NULL,
	`files_analyzed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `code_quizzes_user_id_idx` ON `code_quizzes` (`user_id`);--> statement-breakpoint
CREATE TABLE `code_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`code_quiz_id` text NOT NULL,
	`question_order` integer NOT NULL,
	`question_text` text NOT NULL,
	`code_snippet_path` text NOT NULL,
	`code_snippet_content` text NOT NULL,
	`code_snippet_start_line` integer,
	`code_snippet_end_line` integer,
	`difficulty` text NOT NULL,
	`expected_concepts` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`code_quiz_id`) REFERENCES `code_quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_questions_quiz_order_idx` ON `code_questions` (`code_quiz_id`,`question_order`);--> statement-breakpoint
CREATE INDEX `code_questions_quiz_idx` ON `code_questions` (`code_quiz_id`);--> statement-breakpoint
CREATE TABLE `code_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`code_quiz_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`total_score` real,
	`max_possible_score` real NOT NULL,
	`accuracy_percentage` real,
	`started_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`code_quiz_id`) REFERENCES `code_quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `code_attempts_user_id_idx` ON `code_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `code_attempts_quiz_id_idx` ON `code_attempts` (`code_quiz_id`);--> statement-breakpoint
CREATE TABLE `code_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`code_attempt_id` text NOT NULL,
	`code_question_id` text NOT NULL,
	`user_answer` text NOT NULL,
	`score` real,
	`accuracy_score` real,
	`depth_score` real,
	`completeness_score` real,
	`feedback` text,
	`evaluated_at` text,
	`evaluation_provider` text,
	FOREIGN KEY (`code_attempt_id`) REFERENCES `code_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`code_question_id`) REFERENCES `code_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `code_answers_attempt_question_idx` ON `code_answers` (`code_attempt_id`,`code_question_id`);--> statement-breakpoint
CREATE INDEX `code_answers_attempt_idx` ON `code_answers` (`code_attempt_id`);