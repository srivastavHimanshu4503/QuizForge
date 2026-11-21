CREATE TABLE `classrooms` (
	`id` text PRIMARY KEY NOT NULL,
	`teacher_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`code` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classrooms_code_idx` ON `classrooms` (`code`);--> statement-breakpoint
CREATE INDEX `classrooms_teacher_id_idx` ON `classrooms` (`teacher_id`);--> statement-breakpoint
CREATE TABLE `classroom_members` (
	`id` text PRIMARY KEY NOT NULL,
	`classroom_id` text NOT NULL,
	`student_id` text NOT NULL,
	`joined_at` text NOT NULL,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `classroom_members_class_student_idx` ON `classroom_members` (`classroom_id`,`student_id`);--> statement-breakpoint
CREATE INDEX `classroom_members_student_id_idx` ON `classroom_members` (`student_id`);--> statement-breakpoint
CREATE TABLE `quiz_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`classroom_id` text NOT NULL,
	`teacher_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`quiz_type` text DEFAULT 'mcq' NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_date` text,
	`max_attempts` integer DEFAULT 1 NOT NULL,
	`time_limit_minutes` integer,
	`show_feedback_immediately` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_assignments_classroom_id_idx` ON `quiz_assignments` (`classroom_id`);--> statement-breakpoint
CREATE INDEX `quiz_assignments_teacher_id_idx` ON `quiz_assignments` (`teacher_id`);--> statement-breakpoint
CREATE INDEX `quiz_assignments_quiz_id_idx` ON `quiz_assignments` (`quiz_id`);--> statement-breakpoint
DROP INDEX `attempts_quiz_id_attempt_number_idx`;--> statement-breakpoint
ALTER TABLE `quiz_attempts` ADD `assignment_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_quiz_user_attempt_number_idx` ON `quiz_attempts` (`quiz_id`,`user_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX `attempts_assignment_id_idx` ON `quiz_attempts` (`assignment_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'student' NOT NULL;