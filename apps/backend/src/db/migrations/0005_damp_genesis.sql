CREATE TABLE `certificates` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`user_id` text NOT NULL,
	`recipient_name` text NOT NULL,
	`quiz_title` text NOT NULL,
	`score` integer NOT NULL,
	`total_questions` integer NOT NULL,
	`percentage` real NOT NULL,
	`verification_code` text NOT NULL,
	`issued_at` text NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_verification_code_unique` ON `certificates` (`verification_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_attempt_id_idx` ON `certificates` (`attempt_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_verification_code_idx` ON `certificates` (`verification_code`);--> statement-breakpoint
CREATE INDEX `certificates_user_id_idx` ON `certificates` (`user_id`);