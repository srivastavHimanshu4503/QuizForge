CREATE TABLE `study_room_members` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'participant' NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `study_rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_room_members_room_id_idx` ON `study_room_members` (`room_id`);--> statement-breakpoint
CREATE INDEX `study_room_members_user_id_idx` ON `study_room_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`host_user_id` text NOT NULL,
	`quiz_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`max_participants` integer DEFAULT 10 NOT NULL,
	`created_at` text NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`host_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_rooms_code_unique` ON `study_rooms` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `study_rooms_code_idx` ON `study_rooms` (`code`);--> statement-breakpoint
CREATE INDEX `study_rooms_host_id_idx` ON `study_rooms` (`host_user_id`);--> statement-breakpoint
CREATE INDEX `study_rooms_status_idx` ON `study_rooms` (`status`);