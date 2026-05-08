CREATE INDEX "idx_blocks_blocker_blocked" ON "blocks" USING btree ("blocker_id","blocked_id");--> statement-breakpoint
CREATE INDEX "idx_comments_post" ON "comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_follows_follower_following" ON "follows" USING btree ("follower_id","following_id");--> statement-breakpoint
CREATE INDEX "idx_group_members_group_user" ON "group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_group_messages_group_created" ON "group_messages" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_likes_user_post" ON "likes" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender_receiver" ON "messages" USING btree ("sender_id","receiver_id");--> statement-breakpoint
CREATE INDEX "idx_messages_receiver_status" ON "messages" USING btree ("receiver_id","status");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_created" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_posts_author_created" ON "posts" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_posts_created" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_reports_reported_user_status" ON "reports" USING btree ("reported_user_id","status");--> statement-breakpoint
CREATE INDEX "idx_users_suspended" ON "users" USING btree ("is_suspended","suspended_until");