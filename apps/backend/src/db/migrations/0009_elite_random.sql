CREATE TABLE `lti_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_id` text NOT NULL,
	`quiz_id` text NOT NULL,
	`line_item_url` text NOT NULL,
	`resource_link_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`platform_id`) REFERENCES `lti_platforms`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `lti_platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`issuer` text NOT NULL,
	`client_id` text NOT NULL,
	`auth_endpoint` text NOT NULL,
	`token_endpoint` text NOT NULL,
	`keyset_endpoint` text NOT NULL,
	`deployment_id` text NOT NULL,
	`created_at` text NOT NULL
);
