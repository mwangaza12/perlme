import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { createBlockSchema, unblockSchema } from "../../Validators/Block.validator";
import { BlockService } from "./block.service";

// ========================== CREATE BLOCK ==========================
export const createBlockController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const blockerId = req.user?.id;
    if (!blockerId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const parsed = createBlockSchema.safeParse({
      ...req.body,
      blockerId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const block = await BlockService.createBlock(parsed.data);

    return res.status(201).json({
      message: "User blocked successfully",
      data: block,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to block user",
    });
  }
});

// ========================== REMOVE BLOCK ==========================
export const removeBlockController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const blockerId = req.user?.id;
    if (!blockerId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const parsed = unblockSchema.safeParse({
      ...req.body,
      blockerId,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const result = await BlockService.removeBlock(parsed.data);

    return res.status(200).json({
      message: "User unblocked successfully",
      data: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to unblock user",
    });
  }
});

// ========================== CHECK IF BLOCKED ==========================
export const checkBlockStatusController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const blockerId = req.user?.id;
    const { targetUserId } = req.params as Record<string, string>;

    if (!blockerId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    if (!targetUserId) {
      return res.status(400).json({ error: "Target user ID is required" });
    }

    const isBlocked = await BlockService.isBlocked(blockerId, targetUserId);

    return res.status(200).json({ blocked: isBlocked });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to check block status",
    });
  }
});

// ========================== GET USERS BLOCKED BY ME ==========================
export const getBlockedUsersController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const blockerId = req.user?.id;
    if (!blockerId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const blockedUsers = await BlockService.getBlockedUsers(blockerId);

    return res.status(200).json({
      count: blockedUsers.length,
      data: blockedUsers,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch blocked users",
    });
  }
});

// ========================== GET USERS WHO BLOCKED ME ==========================
export const getBlockedByController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const blockedId = req.user?.id;
    if (!blockedId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const blockedBy = await BlockService.getBlockedBy(blockedId);

    return res.status(200).json({
      count: blockedBy.length,
      data: blockedBy,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch who blocked you",
    });
  }
});
