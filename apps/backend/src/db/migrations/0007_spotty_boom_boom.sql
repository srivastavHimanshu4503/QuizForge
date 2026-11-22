CREATE TABLE `flashcard_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`user_id` text NOT NULL,
	`question_id` text,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`explanation` text,
	`repetition_number` integer DEFAULT 0 NOT NULL,
	`easiness_factor` real DEFAULT 2.5 NOT NULL,
	`interval_days` integer DEFAULT 0 NOT NULL,
	`due_date` text NOT NULL,
	`state` text DEFAULT 'new' NOT NULL,
	`last_reviewed_at` text,
	`review_count` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `flashcard_decks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `cards_deck_id_idx` ON `flashcard_cards` (`deck_id`);--> statement-breakpoint
CREATE INDEX `cards_user_id_idx` ON `flashcard_cards` (`user_id`);--> statement-breakpoint
CREATE INDEX `cards_due_date_idx` ON `flashcard_cards` (`due_date`);--> statement-breakpoint
CREATE INDEX `cards_state_idx` ON `flashcard_cards` (`state`);--> statement-breakpoint
CREATE TABLE `flashcard_decks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`quiz_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `decks_user_id_idx` ON `flashcard_decks` (`user_id`);--> statement-breakpoint
CREATE INDEX `decks_quiz_id_idx` ON `flashcard_decks` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `flashcard_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`previous_interval` integer NOT NULL,
	`new_interval` integer NOT NULL,
	`previous_ef` real NOT NULL,
	`new_ef` real NOT NULL,
	`reviewed_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `flashcard_cards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reviews_card_id_idx` ON `flashcard_reviews` (`card_id`);--> statement-breakpoint
CREATE INDEX `reviews_user_id_idx` ON `flashcard_reviews` (`user_id`);--> statement-breakpoint
CREATE INDEX `reviews_reviewed_at_idx` ON `flashcard_reviews` (`reviewed_at`);