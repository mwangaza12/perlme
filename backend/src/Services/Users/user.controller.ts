import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  deleteUser,
  followUser,
  getAllUsers,
  getUserByEmail,
  getUserById,
  isFollowing,
  isUserActive,
  suspendUser,
  unfollowUser,
  unsuspendUser,
  updateUser,
} from "../Users/users.service";

import { sendNotificationEmail } from "../../Middlewares/GoogleMailer";
import { userValidator } from "../../Validators/users.vslidator";
import { createNotification } from "../Notifications/notification.service";

// ========================== GET ALL USERS ==========================
export const getAllUsersController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    if (!users || users.length === 0) {
      return res.status(404).json({ error: "No users found" });
    }
    res.status(200).json({ count: users.length, data: users });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch users" });
  }
});

// ========================== GET USER BY ID ==========================
export const getUser = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ data: user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user" });
  }
});

// ========================== GET USER BY EMAIL ==========================
export const getUserByEmailController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }
    const user = await getUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ data: user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch user by email" });
  }
});

// ========================== UPDATE USER ==========================
export const updateUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const parsed = userValidator.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const updatedUser = await updateUser(id, parsed.data);
    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ message: "User updated successfully", data: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

// ========================== DELETE USER ==========================
export const deleteUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const deletedUser = await deleteUser(id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });

    const subject = "🗑️ Account Deleted — PerlMe Notification";
    const message = `
      <html>
        <body style="font-family:'Poppins',Arial,sans-serif;background-color:#FFF3E0;padding:40px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <h2 style="color:#FB8C00;">🗑️ Account Deletion Notice</h2>
            <p style="color:#6D4C41;">Hey <strong>${deletedUser.username}</strong>,</p>
            <p style="color:#555;">
              Your PerlMe account has been <strong style="color:#E53935;">permanently deleted</strong> due to policy violations.
              All your data, posts, and account settings have been removed.
            </p>
            <div style="background:#FFE0B2;border-radius:12px;padding:15px;margin:25px 0;">
              <p style="margin:0;color:#BF360C;font-size:15px;">
                If you believe this was an error, contact our support team immediately.
              </p>
            </div>
            <p style="color:#555;">Thank you for your time on PerlMe 💜.</p>
            <hr style="margin:30px 0;border:none;border-top:1px solid #FFE0B2;">
            <p style="font-size:14px;color:#999;">
              💜 With care,<br><strong>The PerlMe Team</strong><br>
              &copy; ${new Date().getFullYear()} PerlMe
            </p>
          </div>
        </body>
      </html>
    `;

    await sendNotificationEmail(deletedUser.email, subject, deletedUser.username, message, message, "alert");

    res.status(200).json({ message: "User deleted due to violations and email sent", data: deletedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
});

// ========================== SUSPEND USER ==========================
export const suspendUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { until } = req.body;

    if (!until) return res.status(400).json({ error: "Suspension 'until' date is required" });

    const suspensionDate = new Date(until);
    const now = new Date();

    if (suspensionDate <= now) return res.status(400).json({ error: "Suspension date must be in the future" });

    const updatedUser = await suspendUser(id, suspensionDate);
    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    // Calculate time remaining in days, hours, minutes
    const diffMs = suspensionDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const diffMinutes = Math.floor((diffMs / (1000 * 60)) % 60);

    const formattedDate = suspensionDate.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const subject = "⚠️ Account Suspended — PerlMe Notification";
    const message = `
      <html>
        <body style="font-family:'Poppins',Arial,sans-serif;background-color:#F3E5F5;padding:40px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:18px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <h2 style="color:#7E57C2;">⚠️ Account Suspension Notice</h2>
            <p style="color:#4A148C;">Hey <strong>${updatedUser.username}</strong>,</p>
            <p style="color:#555;">
              Your PerlMe account has been temporarily suspended and will be automatically reinstated on:
            </p>
            <p style="color:#E53935; font-weight:600; font-size:16px;">${formattedDate}</p>
            <p style="color:#555;">
              That’s in approximately <strong>${diffDays} day${diffDays > 1 ? "s" : ""}, ${diffHours} hour${diffHours > 1 ? "s" : ""}, and ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}</strong>.
            </p>
            <div style="background:#F3E5F5;border-radius:12px;padding:15px;margin:25px 0;">
              <p style="margin:0;color:#6A1B9A;font-size:15px;">
                This action may be due to a policy review or suspicious activity.
              </p>
            </div>
            <p style="color:#555;">
              If you believe this suspension was made in error, please contact support.
            </p>
            <hr style="margin:30px 0;border:none;border-top:1px solid #E1BEE7;">
            <p style="font-size:14px;color:#999;">
              💜 With care,<br><strong>The PerlMe Team</strong><br>
              &copy; ${new Date().getFullYear()} PerlMe
            </p>
          </div>
        </body>
      </html>
    `;

    await sendNotificationEmail(updatedUser.email, subject, updatedUser.username, message, message, "alert");

    res.status(200).json({ message: "User suspended successfully and email sent.", data: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to suspend user" });
  }
});

// ========================== UNSUSPEND USER ==========================
export const unsuspendUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updatedUser = await unsuspendUser(id);
    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    const subject = "🎉 Welcome Back! Your PerlMe Account Is Active Again";
    const message = `
      <html>
        <body style="font-family:'Poppins',Arial,sans-serif;background-color:#E8EAF6;padding:40px;">
          <div style="max-width:600px;margin:auto;background:#fff;padding:30px;border-radius:18px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
            <h2 style="color:#5E35B1;">🎉 Account Reinstated</h2>
            <p style="color:#4A148C;">Hey <strong>${updatedUser.username}</strong>,</p>
            <p style="color:#555;">
              Great news — your account has been successfully <strong style="color:#43A047;">reinstated</strong> and you can now log in again!
            </p>
            <div style="background:#EDE7F6;border-radius:12px;padding:15px;margin:25px 0;">
              <p style="margin:0;color:#6A1B9A;font-size:15px;">
                We're so glad to have you back 💜 Please remember to keep our community a positive, respectful space.
              </p>
            </div>
            <p style="color:#555;">We appreciate your patience and cooperation.</p>
            <a href="https://perlme.app/login" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#7E57C2;color:white;border-radius:10px;text-decoration:none;font-weight:500;">
              Log In to PerlMe
            </a>
            <hr style="margin:30px 0;border:none;border-top:1px solid #D1C4E9;">
            <p style="font-size:14px;color:#999;">
              💜 With love,<br><strong>The PerlMe Team</strong><br>
              &copy; ${new Date().getFullYear()} PerlMe
            </p>
          </div>
        </body>
      </html>
    `;

    await sendNotificationEmail(updatedUser.email, subject, updatedUser.username, message, message, "generic");

    res.status(200).json({ message: "User unsuspended successfully and email sent.", data: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to unsuspend user" });
  }
});

// ========================== CHECK USER STATUS ==========================
export const checkUserStatusController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = await getUserById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const active = isUserActive(user);
    res.status(200).json({ active });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to check user status" });
  }
});

// ========================== FOLLOW USER ==========================
export const followUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const followerId = (req as any).user.id; // Current logged-in user
    const { userId } = req.params as Record<string, string>; // User to follow

    if (followerId === userId) {
      return res.status(400).json({
        success: false,
        message: "You cannot follow yourself"
      });
    }

    const follow = await followUser(followerId, userId);

    // Notify the followed user (fire-and-forget)
    createNotification(
      followerId,
      userId,
      "FOLLOW",
      "started following you"
    ).catch(() => { });

    res.status(200).json({
      success: true,
      message: "User followed successfully",
      data: follow
    });
  } catch (error: any) {
    if (error.message === "Already following this user") {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to follow user"
    });
  }
});

// ========================== UNFOLLOW USER ==========================
export const unfollowUserController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const followerId = (req as any).user.id; // Current logged-in user
    const { userId } = req.params as Record<string, string>; // User to unfollow

    const deleted = await unfollowUser(followerId, userId);
    res.status(200).json({
      success: true,
      message: "User unfollowed successfully",
      data: deleted
    });
  } catch (error: any) {
    if (error.message === "Follow relationship not found") {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to unfollow user"
    });
  }
});

// ========================== CHECK IF FOLLOWING ==========================
export const checkIfFollowingController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const followerId = (req as any).user.id; // Current logged-in user
    const { userId } = req.params as Record<string, string>; // User to check

    const following = await isFollowing(followerId, userId);
    res.status(200).json({
      success: true,
      data: { isFollowing: following }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to check follow status"
    });
  }
});

