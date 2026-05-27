CREATE TABLE `user_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`target_weight_kg` real,
	`weekly_weight_loss_kg` real DEFAULT 0.5,
	`tdee_kcal` integer,
	`target_calories_kcal` integer DEFAULT 1850,
	`target_protein_g` integer DEFAULT 180,
	`target_carbs_g` integer DEFAULT 113,
	`target_fat_g` integer DEFAULT 75,
	`target_steps` integer DEFAULT 10000,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
