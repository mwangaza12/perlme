import { relations } from "drizzle-orm";
import { boolean, doublePrecision, index, integer, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid, varchar, } from "drizzle-orm/pg-core";

// ========================== ENUMS ==========================

export const userRoleEnum = pgEnum("user_role", ["REGULAR", "CREATOR", "MODERATOR", "ADMIN",]);

export const genderEnum = pgEnum("gender", ["MALE", "FEMALE", "NON_BINARY", "OTHER",]);

export const orientationEnum = pgEnum("orientation", ["STRAIGHT", "GAY", "LESBIAN", "BISEXUAL", "ASEXUAL", "PANSEXUAL", "OTHER",]);

export const visibilityEnum = pgEnum("visibility", ["PUBLIC", "PRIVATE", "FRIENDS_ONLY",]);

export const messageStatusEnum = pgEnum("message_status", ["SENT", "DELIVERED", "READ",]);

export const reportStatusEnum = pgEnum("report_status", ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED",]);

export const notificationTypeEnum = pgEnum("notification_type", ["MESSAGE", "LIKE", "COMMENT", "REPOST", "FOLLOW", "TIP", "SUBSCRIPTION", "ADMIN_MESSAGE", "MATCH",]);

export const locationVisibilityEnum = pgEnum("location_visibility", ["VISIBLE", "HIDDEN",]);

export const preferenceTypeEnum = pgEnum("preference_type", ["AGE", "DISTANCE", "GENDER", "INTEREST",]);

export const groupRoleEnum = pgEnum("group_role", ["GROUP_ADMIN", "GROUP_MODERATOR", "GROUP_MEMBER", "GROUP_REMOVED"]);

// ========================== ENUMS (extended) ==========================
export const reportTypeEnum = pgEnum("report_type", ["USER", "POST", "COMMENT", "MESSAGE", "GROUP_MESSAGE",]);

export const reportActionEnum = pgEnum("report_action", ["NONE", "REMOVE_CONTENT",]);

// ========================== ENUMS (profile completion) ==========================
export const pronounsEnum = pgEnum("pronouns", ["HE_HIM", "SHE_HER", "THEY_THEM", "OTHER"]);

export const relationshipIntentionEnum = pgEnum("relationship_intention", [
  "MARRIAGE",
  "LONG_TERM",
  "LONG_TERM_OPEN_SHORT",
  "SHORT_TERM_OPEN_LONG",
  "CASUAL",
  "FRIENDSHIP",
  "FIGURING_OUT",
]);

export const hasChildrenEnum = pgEnum("has_children", ["YES", "NO"]);

export const wantsChildrenEnum = pgEnum("wants_children", ["WANT", "DONT_WANT", "NOT_SURE"]);

export const smokingEnum = pgEnum("smoking_habit", ["NON_SMOKER", "OCCASIONALLY", "SMOKER"]);

export const drinkingEnum = pgEnum("drinking_habit", ["NEVER", "SOCIALLY", "REGULARLY"]);

export const fitnessLevelEnum = pgEnum("fitness_level", ["VERY_ACTIVE", "MODERATELY_ACTIVE", "NOT_ACTIVE"]);

export const educationLevelEnum = pgEnum("education_level", ["HIGH_SCHOOL", "COLLEGE", "BACHELORS", "MASTERS", "PHD"]);

export const distancePreferenceEnum = pgEnum("distance_preference", ["KM_10", "KM_50", "KM_100", "GLOBAL"]);

// ========================== ENUMS (vibe system) ==========================
export const vibeTypeEnum = pgEnum("vibe_type", [
  // Energy
  "SOCIAL_BUTTERFLY",
  "SOLO_ADVENTURER",
  "DEEP_DIVER",
  // Reliability
  "INSTANT_MATCH",
  "SLOW_BURNER",
  "EVENING_STAR",
  // Date Style
  "CAFFEINE_CRITIC",
  "NIGHT_OWL",
  "ACTIVITY_JUNKIE",
  // Humor
  "WITTY_ONE",
  "WHOLESOME",
  "MEME_DEALER",
]);

// ========================== USERS ==========================
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 255 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  gender: genderEnum("gender"),
  orientation: orientationEnum("orientation"),
  isSuspended: boolean("is_suspended").default(false),
  suspendedUntil: timestamp("suspended_until"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  coverPhotoUrl: text("cover_photo_url"),
  pronouns: pronounsEnum("pronouns"),
  relationshipIntention: relationshipIntentionEnum("relationship_intention"),
  hasChildren: hasChildrenEnum("has_children"),
  wantsChildren: wantsChildrenEnum("wants_children"),
  smoking: smokingEnum("smoking_habit"),
  drinking: drinkingEnum("drinking_habit"),
  fitnessLevel: fitnessLevelEnum("fitness_level"),
  educationLevel: educationLevelEnum("education_level"),
  occupation: varchar("occupation", { length: 255 }),
  industry: varchar("industry", { length: 255 }),
  ethnicity: varchar("ethnicity", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 20 }).unique(),
  phoneConfirmationCode: varchar("phone_confirmation_code", { length: 10 }),
  phoneConfirmationCodeExpiresAt: timestamp("phone_confirmation_code_expires_at"),
  isVerified: boolean("is_verified").default(false),
  isPhoneVerified: boolean("is_phone_verified").default(false),
  isPhotoVerified: boolean("is_photo_verified").default(false),
  profileCompletedAt: timestamp("profile_completed_at"),
  confirmationCode: varchar("confirmation_code", { length: 255 }),
  confirmationCodeExpiresAt: timestamp("confirmation_code_expires_at"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  accountLockedUntil: timestamp("account_locked_until"),
  visibility: visibilityEnum("visibility").default("PUBLIC"),
  role: userRoleEnum("role").default("REGULAR").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_users_suspended").on(table.isSuspended, table.suspendedUntil),
]);


// ========================== INTERESTS ==========================
export const interests = pgTable("interests", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pivot: Users ↔ Interests
export const userInterests = pgTable("user_interests", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  interestId: uuid("interest_id")
    .references(() => interests.id, { onDelete: "cascade" })
    .notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ========================== LANGUAGES ==========================
export const languages = pgTable("languages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  code: varchar("code", { length: 10 }).unique().notNull(), // e.g. "en", "fr", "sw"
  createdAt: timestamp("created_at").defaultNow(),
});

// Pivot: Users ↔ Languages
export const userLanguages = pgTable("user_languages", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  languageId: uuid("language_id")
    .references(() => languages.id, { onDelete: "cascade" })
    .notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ========================== PERSONALITY TRAITS ==========================
export const personalityTraits = pgTable("personality_traits", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pivot: Users ↔ Personality Traits
export const userPersonalityTraits = pgTable("user_personality_traits", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  traitId: uuid("trait_id")
    .references(() => personalityTraits.id, { onDelete: "cascade" })
    .notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ========================== DISCOVERY PREFERENCES ==========================
// Structured replacement for the generic userPreferences for matching/discovery logic
export const userDiscoveryPreferences = pgTable("user_discovery_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(), // one record per user
  minAge: integer("min_age").default(18),
  maxAge: integer("max_age").default(99),
  distanceKm: integer("distance_km"),
  distancePreference: distancePreferenceEnum("distance_preference").default("KM_50"),
  showLocation: boolean("show_location").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================== INTERESTED IN (who the user wants to see) ==========================
export const userInterestedIn = pgTable("user_interested_in", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  gender: genderEnum("gender").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ========================== FOLLOWS ==========================
export const follows = pgTable("follows", {
  id: uuid("id").primaryKey().defaultRandom(),
  followerId: uuid("follower_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  followingId: uuid("following_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_follows_follower_following").on(table.followerId, table.followingId),
]);

// ========================== BLOCKS ==========================
export const blocks = pgTable("blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  blockerId: uuid("blocker_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  blockedId: uuid("blocked_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_blocks_blocker_blocked").on(table.blockerId, table.blockedId),
]);

// ========================== MESSAGES ==========================
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  senderId: uuid("sender_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  receiverId: uuid("receiver_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 50 }),
  status: messageStatusEnum("status").default("SENT"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_messages_sender_receiver").on(table.senderId, table.receiverId),
  index("idx_messages_receiver_status").on(table.receiverId, table.status),
]);

// ========================== POSTS ==========================
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_posts_author_created").on(table.authorId, table.createdAt),
  index("idx_posts_created").on(table.createdAt),
]);

// ========================== MEDIA (for posts) ==========================
export const media = pgTable("media", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  url: text("url").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // image, video, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// ========================== COMMENTS ==========================
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_comments_post").on(table.postId),
]);

// ========================== LIKES ==========================
export const likes = pgTable("likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_likes_user_post").on(table.userId, table.postId),
]);

// ========================== TAGS ==========================
export const tags = pgTable("tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).unique().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pivot: Posts ↔ Tags
export const postTags = pgTable("post_tags", {
  postId: uuid("post_id")
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  tagId: uuid("tag_id")
    .references(() => tags.id, { onDelete: "cascade" })
    .notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ========================== REPORTS (Enhanced) ==========================
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Who reported
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Who or what is being reported
  reportedUserId: uuid("reported_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Optional — if this is content-based reporting
  postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "set null" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  groupMessageId: uuid("group_message_id").references(() => groupMessages.id, { onDelete: "set null" }),
  // 👇 New field for moderation actions
  action: reportActionEnum("action").default("NONE").notNull(),

  // Report details
  type: reportTypeEnum("type").default("USER"),
  reason: text("reason").notNull(),
  details: text("details"), // optional additional context

  // Moderation lifecycle
  status: reportStatusEnum("status").default("PENDING"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_reports_reported_user_status").on(table.reportedUserId, table.status),
]);


// ========================== LOCATIONS ==========================
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(), // ensures one location per user
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  visibility: locationVisibilityEnum("visibility").default("VISIBLE"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================== USER PREFERENCES ==========================
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  type: preferenceTypeEnum("type").notNull(),
  value: varchar("value", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// ========================== GROUP CHATS ==========================
export const groupChats = pgTable("group_chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  creatorId: uuid("creator_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  avatarUrl: text("avatar_url"),
  isPrivate: boolean("is_private").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================== GROUP MEMBERS ==========================
export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => groupChats.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: groupRoleEnum("role").default("GROUP_MEMBER").notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("idx_group_members_group_user").on(table.groupId, table.userId),
]);

// ========================== GROUP MESSAGES ==========================
export const groupMessages = pgTable("group_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .references(() => groupChats.id, { onDelete: "cascade" })
    .notNull(),
  senderId: uuid("sender_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  mediaType: varchar("media_type", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_group_messages_group_created").on(table.groupId, table.createdAt),
]);

// ========================== POST METRICS ==========================
export const postMetrics = pgTable("post_metrics", {
  postId: uuid("post_id")
    .references(() => posts.id, { onDelete: "cascade" })
    .primaryKey(),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  shareCount: integer("share_count").default(0),
  viewCount: integer("view_count").default(0),
  score: doublePrecision("score").default(0), // trending score
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================== USER METRICS ==========================
export const userMetrics = pgTable("user_metrics", {
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .primaryKey(),
  followersCount: integer("followers_count").default(0),
  followingCount: integer("following_count").default(0),
  postsCount: integer("posts_count").default(0),
  likesReceived: integer("likes_received").default(0),
  engagementScore: doublePrecision("engagement_score").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================== GROUP TAGS ==========================
export const groupTags = pgTable("group_tags", {
  groupId: uuid("group_id")
    .references(() => groupChats.id, { onDelete: "cascade" })
    .notNull(),
  tagId: uuid("tag_id")
    .references(() => tags.id, { onDelete: "cascade" })
    .notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ========================== VIBE VOTES ==========================
// One vote per (voter → target) pair; voter can change their pick.
export const vibeVotes = pgTable("vibe_votes", {
  id: uuid("id").primaryKey().defaultRandom(),
  voterId: uuid("voter_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  targetUserId: uuid("target_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  vibeType: vibeTypeEnum("vibe_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.voterId, table.targetUserId),
]);

// ========================== USER VIBE COUNTS (denormalized) ==========================
// Composite PK on (targetUserId, vibeType) — enables fast upsert.
export const userVibeCounts = pgTable("user_vibe_counts", {
  targetUserId: uuid("target_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  vibeType: vibeTypeEnum("vibe_type").notNull(),
  count: integer("count").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.targetUserId, table.vibeType] }),
]);

// ========================== INTERACTIONS ==========================
export const interactions = pgTable("interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(), // actor
  targetUserId: uuid("target_user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(), // recipient
  type: varchar("type", { length: 50 }).notNull(), // e.g. "VIEW", "FOLLOW", "LIKE_PROFILE"
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  posts: many(posts),
  messagesSent: many(messages, { relationName: "sender" }),
  messagesReceived: many(messages, { relationName: "receiver" }),
  interests: many(userInterests),
  followers: many(follows, { relationName: "follower" }),
  following: many(follows, { relationName: "following" }),
  likes: many(likes),
  comments: many(comments),
  blocks: many(blocks, { relationName: "blocker" }),
  blockedBy: many(blocks, { relationName: "blocked" }),
  reportsMade: many(reports, { relationName: "reporter" }),
  reportsReceived: many(reports, { relationName: "reportedUser" }),
  location: one(locations, { fields: [users.id], references: [locations.userId] }),
  preferences: many(userPreferences),
  languages: many(userLanguages),
  personalityTraits: many(userPersonalityTraits),
  discoveryPreferences: one(userDiscoveryPreferences, { fields: [users.id], references: [userDiscoveryPreferences.userId] }),
  interestedIn: many(userInterestedIn),
  notificationsReceived: many(notifications, { relationName: "notificationRecipient" }),
  notificationsSent: many(notifications, { relationName: "notificationActor" }),
  vibeVotesGiven: many(vibeVotes, { relationName: "vibeVoter" }),
  vibeVotesReceived: many(vibeVotes, { relationName: "vibeTarget" }),
  vibeCounts: many(userVibeCounts),
}));

export const interestsRelations = relations(interests, ({ many }) => ({
  users: many(userInterests),
}));

export const userInterestsRelations = relations(userInterests, ({ one }) => ({
  user: one(users, { fields: [userInterests.userId], references: [users.id] }),
  interest: one(interests, { fields: [userInterests.interestId], references: [interests.id] }),
}));

export const languagesRelations = relations(languages, ({ many }) => ({
  users: many(userLanguages),
}));

export const userLanguagesRelations = relations(userLanguages, ({ one }) => ({
  user: one(users, { fields: [userLanguages.userId], references: [users.id] }),
  language: one(languages, { fields: [userLanguages.languageId], references: [languages.id] }),
}));

export const personalityTraitsRelations = relations(personalityTraits, ({ many }) => ({
  users: many(userPersonalityTraits),
}));

export const userPersonalityTraitsRelations = relations(userPersonalityTraits, ({ one }) => ({
  user: one(users, { fields: [userPersonalityTraits.userId], references: [users.id] }),
  trait: one(personalityTraits, { fields: [userPersonalityTraits.traitId], references: [personalityTraits.id] }),
}));

export const userDiscoveryPreferencesRelations = relations(userDiscoveryPreferences, ({ one }) => ({
  user: one(users, { fields: [userDiscoveryPreferences.userId], references: [users.id] }),
}));

export const userInterestedInRelations = relations(userInterestedIn, ({ one }) => ({
  user: one(users, { fields: [userInterestedIn.userId], references: [users.id] }),
}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

export const locationsRelations = relations(locations, ({ one }) => ({
  user: one(users, { fields: [locations.userId], references: [users.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  likes: many(likes),
  comments: many(comments),
  tags: many(postTags),
  media: many(media),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  user: one(users, { fields: [comments.userId], references: [users.id] }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  post: one(posts, { fields: [likes.postId], references: [posts.id] }),
  user: one(users, { fields: [likes.userId], references: [users.id] }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  post: one(posts, { fields: [media.postId], references: [posts.id] }),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id] }),
  reportedUser: one(users, { fields: [reports.reportedUserId], references: [users.id] }),
  reviewedByUser: one(users, { fields: [reports.reviewedBy], references: [users.id] }),
  post: one(posts, { fields: [reports.postId], references: [posts.id] }),
  comment: one(comments, { fields: [reports.commentId], references: [comments.id] }),
  message: one(messages, { fields: [reports.messageId], references: [messages.id] }),
  groupMessage: one(groupMessages, { fields: [reports.groupMessageId], references: [groupMessages.id], }),
}));


export const groupChatsRelations = relations(groupChats, ({ one, many }) => ({
  creator: one(users, { fields: [groupChats.creatorId], references: [users.id] }),
  members: many(groupMembers),
  messages: many(groupMessages),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groupChats, { fields: [groupMembers.groupId], references: [groupChats.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(groupChats, { fields: [groupMessages.groupId], references: [groupChats.id] }),
  sender: one(users, { fields: [groupMessages.senderId], references: [users.id] }),
}));

export const postMetricsRelations = relations(postMetrics, ({ one }) => ({
  post: one(posts, {
    fields: [postMetrics.postId],
    references: [posts.id],
  }),
}));

export const userMetricsRelations = relations(userMetrics, ({ one }) => ({
  user: one(users, {
    fields: [userMetrics.userId],
    references: [users.id],
  }),
}));

export const groupTagsRelations = relations(groupTags, ({ one }) => ({
  group: one(groupChats, {
    fields: [groupTags.groupId],
    references: [groupChats.id],
  }),
  tag: one(tags, {
    fields: [groupTags.tagId],
    references: [tags.id],
  }),
}));

export const vibeVotesRelations = relations(vibeVotes, ({ one }) => ({
  voter: one(users, { fields: [vibeVotes.voterId], references: [users.id], relationName: "vibeVoter" }),
  targetUser: one(users, { fields: [vibeVotes.targetUserId], references: [users.id], relationName: "vibeTarget" }),
}));

export const userVibeCountsRelations = relations(userVibeCounts, ({ one }) => ({
  targetUser: one(users, { fields: [userVibeCounts.targetUserId], references: [users.id] }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  user: one(users, {
    fields: [interactions.userId],
    references: [users.id],
    relationName: "interactionActor",
  }),
  targetUser: one(users, {
    fields: [interactions.targetUserId],
    references: [users.id],
    relationName: "interactionTarget",
  }),
}));
// ========================== TYPES ==========================
export type TSelectUser = typeof users.$inferSelect;
export type TInsertUser = typeof users.$inferInsert;

export type TSelectInterest = typeof interests.$inferSelect;
export type TInsertInterest = typeof interests.$inferInsert;

export type TSelectFollow = typeof follows.$inferSelect;
export type TInsertFollow = typeof follows.$inferInsert;

export type TSelectMessage = typeof messages.$inferSelect;
export type TInsertMessage = typeof messages.$inferInsert;

export type TSelectPost = typeof posts.$inferSelect;
export type TInsertPost = typeof posts.$inferInsert;

export type TSelectComment = typeof comments.$inferSelect;
export type TInsertComment = typeof comments.$inferInsert;

export type TSelectLike = typeof likes.$inferSelect;
export type TInsertLike = typeof likes.$inferInsert;

export type TSelectBlock = typeof blocks.$inferSelect;
export type TInsertBlock = typeof blocks.$inferInsert;

export type TSelectLocation = typeof locations.$inferSelect;
export type TInsertLocation = typeof locations.$inferInsert;

export type VibeType = typeof vibeTypeEnum.enumValues[number];
export type TSelectVibeVote = typeof vibeVotes.$inferSelect;
export type TInsertVibeVote = typeof vibeVotes.$inferInsert;
export type TSelectUserVibeCount = typeof userVibeCounts.$inferSelect;

export type TSelectUserPreference = typeof userPreferences.$inferSelect;
export type TInsertUserPreference = typeof userPreferences.$inferInsert;

export type TSelectTag = typeof tags.$inferSelect;
export type TInsertTag = typeof tags.$inferInsert;

export type TSelectPostTag = typeof postTags.$inferSelect;
export type TInsertPostTag = typeof postTags.$inferInsert;

export type TSelectMedia = typeof media.$inferSelect;
export type TInsertMedia = typeof media.$inferInsert;

export type TSelectReport = typeof reports.$inferSelect;
export type TInsertReport = typeof reports.$inferInsert;

export type TSelectGroupChat = typeof groupChats.$inferSelect;
export type TInsertGroupChat = typeof groupChats.$inferInsert;

export type TSelectLanguage = typeof languages.$inferSelect;
export type TInsertLanguage = typeof languages.$inferInsert;

export type TSelectUserLanguage = typeof userLanguages.$inferSelect;
export type TInsertUserLanguage = typeof userLanguages.$inferInsert;

export type TSelectPersonalityTrait = typeof personalityTraits.$inferSelect;
export type TInsertPersonalityTrait = typeof personalityTraits.$inferInsert;

export type TSelectUserPersonalityTrait = typeof userPersonalityTraits.$inferSelect;
export type TInsertUserPersonalityTrait = typeof userPersonalityTraits.$inferInsert;

export type TSelectUserDiscoveryPreferences = typeof userDiscoveryPreferences.$inferSelect;
export type TInsertUserDiscoveryPreferences = typeof userDiscoveryPreferences.$inferInsert;

export type TSelectUserInterestedIn = typeof userInterestedIn.$inferSelect;
export type TInsertUserInterestedIn = typeof userInterestedIn.$inferInsert;

export type TSelectGroupMember = typeof groupMembers.$inferSelect;
export type TInsertGroupMember = typeof groupMembers.$inferInsert;

export type TSelectGroupMessage = typeof groupMessages.$inferSelect;
export type TInsertGroupMessage = typeof groupMessages.$inferInsert;

export type TSelectPostMetric = typeof postMetrics.$inferSelect;
export type TInsertPostMetric = typeof postMetrics.$inferInsert;

export type TSelectUserMetric = typeof userMetrics.$inferSelect;
export type TInsertUserMetric = typeof userMetrics.$inferInsert;

export type TSelectGroupTag = typeof groupTags.$inferSelect;
export type TInsertGroupTag = typeof groupTags.$inferInsert;

export type TSelectInteraction = typeof interactions.$inferSelect;
export type TInsertInteraction = typeof interactions.$inferInsert;

// ========================== NOTIFICATIONS TABLE ==========================
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(), // recipient
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "cascade" }), // who triggered
  type: notificationTypeEnum("type").notNull(),
  entityId: uuid("entity_id"), // postId, messageId, etc.
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_notifications_user_read").on(table.userId, table.isRead),
  index("idx_notifications_user_created").on(table.userId, table.createdAt),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: "notificationRecipient",
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: "notificationActor",
  }),
}));

export type TSelectNotification = typeof notifications.$inferSelect;
export type TInsertNotification = typeof notifications.$inferInsert;
