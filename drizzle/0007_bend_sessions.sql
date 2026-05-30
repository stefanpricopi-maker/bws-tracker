CREATE TABLE `bend_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`date` text NOT NULL,
	`timestamp` integer NOT NULL,
	`routine_name` text NOT NULL,
	`session_json` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bend_sessions_user_date_idx` ON `bend_sessions` (`user_id`,`date`);
