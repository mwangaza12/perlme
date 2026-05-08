import { logger } from "../../utils/logger";
import db from "../../drizzle/db";
import {
  reports,
  users,
  posts,
  comments,
  messages,
  groupMessages,
} from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import {
  createReportValidator,
  updateReportValidator,
  reportStatusEnum,
  TCreateReport,
  TUpdateReport,
} from "../../Validators/Report.validator";

// ========================== CREATE REPORT ==========================
export const createReport = async (data: TCreateReport) => {
  const validated = createReportValidator.parse(data);

  return await db.transaction(async (tx) => {
    // ✅ Ensure reporter and reported users exist
    const [reporterExists] = await tx
      .select()
      .from(users)
      .where(eq(users.id, validated.reporterId));

    const [reportedExists] = await tx
      .select()
      .from(users)
      .where(eq(users.id, validated.reportedUserId));

    if (!reporterExists || !reportedExists) {
      throw new Error("Invalid reporter or reported user ID");
    }

    // ✅ Validate optional referenced content
    if (validated.postId) {
      const [postExists] = await tx
        .select()
        .from(posts)
        .where(eq(posts.id, validated.postId));
      if (!postExists) throw new Error("Referenced post not found");
    }

    if (validated.commentId) {
      const [commentExists] = await tx
        .select()
        .from(comments)
        .where(eq(comments.id, validated.commentId));
      if (!commentExists) throw new Error("Referenced comment not found");
    }

    if (validated.messageId) {
      const [msgExists] = await tx
        .select()
        .from(messages)
        .where(eq(messages.id, validated.messageId));
      if (!msgExists) throw new Error("Referenced message not found");
    }

    if (validated.groupMessageId) {
      const [gMsgExists] = await tx
        .select()
        .from(groupMessages)
        .where(eq(groupMessages.id, validated.groupMessageId));
      if (!gMsgExists) throw new Error("Referenced group message not found");
    }

    // ✅ Create the report
    const [report] = await tx
      .insert(reports)
      .values({
        ...validated,
        status: "PENDING",
        createdAt: new Date(),
      })
      .returning();

    // ✅ Count active reports against this user
    const userReports = await tx
      .select()
      .from(reports)
      .where(eq(reports.reportedUserId, validated.reportedUserId));

    const activeReports = userReports.filter(
      (r) => r.status === "PENDING" || r.status === "REVIEWED"
    ).length;

    // ✅ Auto-suspend after 5+ active reports
    let suspendedUser: any = null;
    if (activeReports >= 5) {
      const suspensionUntil = new Date();
      suspensionUntil.setDate(suspensionUntil.getDate() + 7);

      const [updatedUser] = await tx
        .update(users)
        .set({ isSuspended: true, suspendedUntil: suspensionUntil })
        .where(eq(users.id, validated.reportedUserId))
        .returning();

      logger.warn(
        `User ${validated.reportedUserId} auto-suspended for 7 days after ${activeReports} reports.`
      );

      suspendedUser = updatedUser;
    }

    return { report, suspendedUser };
  });
};

// ========================== GET ALL REPORTS ==========================
export const getAllReports = async () => {
  return await db.select().from(reports);
};

// ========================== GET REPORTS BY USER ==========================
export const getReportsByUser = async (userId: string) => {
  return await db
    .select()
    .from(reports)
    .where(eq(reports.reportedUserId, userId));
};

// ========================== GET REPORTS BY STATUS ==========================
export const getReportsByStatus = async (status: string) => {
  if (!Object.values(reportStatusEnum.enum).includes(status as any)) {
    throw new Error("Invalid report status value");
  }

  return await db.select().from(reports).where(eq(reports.status, status as any));
};

// ========================== UPDATE REPORT STATUS (Admin/Moderator) ==========================
export const updateReportStatus = async (id: string, data: TUpdateReport) => {
  const validated = updateReportValidator.parse(data);

  return await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(reports).where(eq(reports.id, id));
    if (!existing) throw new Error("Report not found");

    // 🚨 Content removal — all deletes happen atomically before the status update
    if ((validated as any).action === "REMOVE_CONTENT") {
      if (existing.postId) {
        await tx.delete(posts).where(eq(posts.id, existing.postId));
        logger.info(`Post ${existing.postId} removed due to report ${id}`);
      }
      if (existing.commentId) {
        await tx.delete(comments).where(eq(comments.id, existing.commentId));
        logger.info(`Comment ${existing.commentId} removed due to report ${id}`);
      }
      if (existing.messageId) {
        await tx.delete(messages).where(eq(messages.id, existing.messageId));
        logger.info(`Message ${existing.messageId} removed due to report ${id}`);
      }
      if (existing.groupMessageId) {
        await tx.delete(groupMessages).where(eq(groupMessages.id, existing.groupMessageId));
        logger.info(`Group message ${existing.groupMessageId} removed due to report ${id}`);
      }
    }

    // ✅ Update report status
    const [updated] = await tx
      .update(reports)
      .set({ status: validated.status ?? "REVIEWED", resolvedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();

    // ✅ Lift suspension if active reports drop below threshold
    const remainingReports = await tx
      .select()
      .from(reports)
      .where(eq(reports.reportedUserId, existing.reportedUserId));

    const activeReports = remainingReports.filter(
      (r) => r.status === "PENDING" || r.status === "REVIEWED"
    ).length;

    if (activeReports < 5) {
      await tx
        .update(users)
        .set({ isSuspended: false, suspendedUntil: null })
        .where(eq(users.id, existing.reportedUserId));
    }

    return updated;
  });
};

// ========================== DELETE REPORT ==========================
export const deleteReport = async (id: string) => {
  const [existing] = await db.select().from(reports).where(eq(reports.id, id));
  if (!existing) throw new Error("Report not found");

  const [deleted] = await db.delete(reports).where(eq(reports.id, id)).returning();
  return deleted;
};
