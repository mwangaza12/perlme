import { logger } from "../../utils/logger";
import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createReport,
  getAllReports,
  getReportsByUser,
  getReportsByStatus,
  updateReportStatus,
  deleteReport,
} from "../../Services/Reports/report.service";
import db from "../../drizzle/db";
import { users, reports } from "../../drizzle/schema";
import { eq, and, isNull } from "drizzle-orm";
import {
  createReportValidator,
  updateReportValidator,
} from "../../Validators/Report.validator";
import { sendNotificationEmail } from "../../Middlewares/GoogleMailer";

// ========================== HELPER: GET ALL ADMIN EMAILS ==========================
const getAdminEmails = async (): Promise<string[]> => {
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "ADMIN"));
  return admins.map(a => a.email);
};

// ========================== CREATE REPORT ==========================
export const createReportController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const reporterId = req.user?.id;
    if (!reporterId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const parsed = createReportValidator.safeParse({
      ...req.body,
      reporterId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const { reportedUserId, postId, commentId } = parsed.data;

    // ========================= CHECK FOR DUPLICATE REPORT =========================


// inside your duplicate report check
const existingReport = await db
  .select()
  .from(reports)
  .where(
    and(
      eq(reports.reporterId, reporterId),
      eq(reports.reportedUserId, reportedUserId),
      postId ? eq(reports.postId, postId) : isNull(reports.postId),
      commentId ? eq(reports.commentId, commentId) : isNull(reports.commentId)
    )
  );


    if (existingReport.length > 0) {
      return res.status(400).json({
        error: "You have already reported this user for this specific post/comment.",
      });
    }

    // ✅ Create report
    const { report } = await createReport(parsed.data);

    // ✅ Count total reports for reported user
    const userReports = await db
      .select()
      .from(reports)
      .where(eq(reports.reportedUserId, reportedUserId));

    const totalReports = userReports.length;
    let suspendedUser: any = null;

    // ✅ Auto-suspend after 3+ reports
    if (totalReports >= 3) {
      const suspensionUntil = new Date();
      suspensionUntil.setDate(suspensionUntil.getDate() + 7); // 7 days

      const [updatedUser] = await db
        .update(users)
        .set({
          isSuspended: true,
          suspendedUntil: suspensionUntil,
        })
        .where(eq(users.id, reportedUserId))
        .returning();

      suspendedUser = updatedUser;

      // Calculate remaining suspension time
      const now = new Date();
      const diffMs = suspensionUntil.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const formattedDate = suspensionUntil.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // ========================== EMAIL TEMPLATES ==========================
      const suspensionHtml = `
        <html>
          <body style="font-family:'Poppins',Arial,sans-serif;background-color:#F3E5F5;padding:40px;">
            <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <h2 style="color:#7E57C2;">⚠️ Account Suspension Notice</h2>
              <p style="color:#4A148C;">Hey <strong>${updatedUser.username}</strong>,</p>
              <p style="color:#555;">
                Your PerlMe account has been temporarily suspended for the following reason: <strong>${parsed.data.reason}</strong>
              </p>
              <p style="color:#555;">
                Your account will be automatically reinstated on:
              </p>
              <p style="color:#E53935; font-weight:600; font-size:16px;">${formattedDate}</p>
              <p style="color:#555;">
                That’s in approximately <strong>${diffDays} day${diffDays !== 1 ? "s" : ""}, ${diffHours} hour${diffHours !== 1 ? "s" : ""}, and ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}</strong>.
              </p>
              <div style="background:#F3E5F5;border-radius:12px;padding:15px;margin:25px 0;">
                <p style="margin:0;color:#6A1B9A;font-size:15px;">
                  Please contact support if you believe this suspension was made in error.
                </p>
              </div>
              <hr style="margin:30px 0;border:none;border-top:1px solid #E1BEE7;">
              <p style="font-size:14px;color:#999;">
                💜 With care,<br><strong>The PerlMe Team</strong><br>
                &copy; ${new Date().getFullYear()} PerlMe
              </p>
            </div>
          </body>
        </html>
      `;

      const adminHtml = `
        <html>
          <body style="font-family:'Poppins',Arial,sans-serif;background-color:#F0F4F8;padding:40px;">
            <div style="max-width:700px;margin:auto;background:#fff;padding:30px;border-radius:18px;box-shadow:0 6px 18px rgba(0,0,0,0.08);">
              <h2 style="color:#B71C1C;">🚨 User Suspension Alert</h2>
              <p style="color:#333;">The following user has been suspended due to multiple reports:</p>
              <table style="width:100%; border-collapse:collapse; margin-top:20px;">
                <tr><td style="padding:8px; font-weight:600; width:150px;">Username</td><td style="padding:8px;">${updatedUser.username}</td></tr>
                <tr><td style="padding:8px; font-weight:600;">Email</td><td style="padding:8px;">${updatedUser.email}</td></tr>
                <tr><td style="padding:8px; font-weight:600;">User ID</td><td style="padding:8px;">${updatedUser.id}</td></tr>
                <tr><td style="padding:8px; font-weight:600;">Total Reports</td><td style="padding:8px;">${totalReports}</td></tr>
                <tr><td style="padding:8px; font-weight:600;">Reason</td><td style="padding:8px;">${parsed.data.reason}</td></tr>
                <tr><td style="padding:8px; font-weight:600;">Suspended Until</td><td style="padding:8px;">${formattedDate}</td></tr>
              </table>
              <p style="margin-top:20px; color:#555;">Please review this account and decide if further action is required.</p>
              <hr style="margin:30px 0;border:none;border-top:1px solid #E5E7EB;">
              <p style="font-size:14px;color:#999;">PerlMe Moderation System</p>
            </div>
          </body>
        </html>
      `;

      // ========================== SEND EMAILS ==========================
      const adminEmails = await getAdminEmails();

      await Promise.all([
        sendNotificationEmail(
          updatedUser.email,
          "🚫 Account Suspension Notice",
          updatedUser.username,
          `Your PerlMe account has been suspended. Reason: ${parsed.data.reason}`,
          suspensionHtml,
          "suspension"
        ),
        ...adminEmails.map(email =>
          sendNotificationEmail(
            email,
            "⚠️ User Suspension Alert",
            "Admin",
            `A user has been suspended. Reason: ${parsed.data.reason}`,
            adminHtml,
            "alert"
          )
        ),
      ]);

      logger.info(
        `📧 Suspension emails sent to ${updatedUser.email} and admins: ${adminEmails.join(
          ", "
        )}`
      );
    }

    return res.status(201).json({
      message: "Report created successfully",
      data: report,
      ...(suspendedUser && {
        suspendedUser,
        info: `User auto-suspended for 7 days after ${totalReports} reports.`,
      }),
    });
  } catch (error: any) {
    logger.error("❌ Error creating report:", error);
    return res.status(500).json({
      error: error.message || "Failed to create report",
    });
  }
});

// ========================== GET ALL REPORTS ==========================
export const getAllReportsController = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const reports = await getAllReports();
    if (!reports.length) {
      return res.status(404).json({ message: "No reports found" });
    }

    return res.status(200).json({ count: reports.length, data: reports });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch reports",
    });
  }
});

// ========================== GET REPORTS BY USER ==========================
export const getReportsByUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { userId } = req.params as Record<string, string>;
    const reportsByUser = await getReportsByUser(userId);

    if (!reportsByUser.length) {
      return res.status(404).json({ message: "No reports for this user" });
    }

    return res.status(200).json({
      count: reportsByUser.length,
      data: reportsByUser,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch user reports",
    });
  }
});

// ========================== GET REPORTS BY STATUS ==========================
export const getReportsByStatusController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { status } = req.params as Record<string, string>;
    const reportsByStatus = await getReportsByStatus(status);

    if (!reportsByStatus.length) {
      return res.status(404).json({ message: "No reports found for this status" });
    }

    return res.status(200).json({
      count: reportsByStatus.length,
      data: reportsByStatus,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch reports by status",
    });
  }
});

// ========================== UPDATE REPORT STATUS ==========================
export const updateReportStatusController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params as Record<string, string>;
    const parsed = updateReportValidator.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const updatedReport = await updateReportStatus(reportId, parsed.data);
    if (!updatedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    let unsuspendedUser: any = null;

    // ✅ Auto-unsuspend logic: if action is NONE, unsuspend reported user
    if (updatedReport.action === "NONE") {
      const [user] = await db
        .update(users)
        .set({
          isSuspended: false,
          suspendedUntil: null,
        })
        .where(eq(users.id, updatedReport.reportedUserId))
        .returning();

      unsuspendedUser = user;

      // ========================== EMAIL ==========================
      const unsuspendHtml = `
        <html>
          <body style="font-family:'Poppins',Arial,sans-serif;background-color:#E8F5E9;padding:40px;">
            <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <h2 style="color:#2E7D32;">✅ Account Reinstated</h2>
              <p>Hey <strong>${user.username}</strong>,</p>
              <p style="color:#555;">
                Following a thorough review of the reports and actions taken, your PerlMe account has been reinstated.
              </p>
              <p style="color:#555;">
                Your account is now active and you can continue to access all features as usual. 
                Please remember to use the app responsibly and adhere to the community guidelines to avoid future issues.
              </p>
              <p style="color:#555;">
                Stay mindful of your interactions on the platform and be careful to follow the rules—it helps ensure a safe and enjoyable experience for everyone.
              </p>
              <hr style="margin:30px 0;border:none;border-top:1px solid #C8E6C9;">
              <p style="font-size:14px;color:#555;">
                📌 Summary of reinstatement:<br>
                - Account reviewed by moderation team<br>
                - All restrictions removed<br>
                - Full access restored
              </p>
              <hr style="margin:20px 0;border:none;border-top:1px solid #C8E6C9;">
              <p style="font-size:14px;color:#999;">
                💜 With care,<br><strong>The PerlMe Team</strong><br>
                &copy; ${new Date().getFullYear()} PerlMe
              </p>
            </div>
          </body>
        </html>
      `;

      await sendNotificationEmail(
        user.email,
        "✅ Your PerlMe account has been reinstated",
        user.username,
        "Your account has been reinstated after review.",
        unsuspendHtml,
        "unsuspension"
      );
    }

    return res.status(200).json({
      message: "Report status updated successfully",
      data: updatedReport,
      ...(unsuspendedUser && { unsuspendedUser, info: "User has been reinstated." }),
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to update report status",
    });
  }
});

// ========================== DELETE REPORT ==========================
export const deleteReportController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params as Record<string, string>;
    const deletedReport = await deleteReport(reportId);

    if (!deletedReport) {
      return res.status(404).json({ error: "Report not found" });
    }

    return res.status(200).json({
      message: "Report deleted successfully",
      data: deletedReport,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to delete report",
    });
  }
});

