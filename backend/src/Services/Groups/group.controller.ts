import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
  createGroup,
  getAllGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  updateMemberRole,
  getGroupMembers,
  sendGroupMessage,
  getGroupMessages,
} from "../Groups/group.service";
import {
  groupChatValidator,
  groupMessageValidator,
} from "../../Validators/Group.Validators";

// ========================== CREATE GROUP ==========================
export const createGroupController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const creatorId = req.user?.id;
    if (!creatorId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const parsed = groupChatValidator.safeParse({ ...req.body, creatorId });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const group = await createGroup(parsed.data);
    return res.status(201).json({
      message: "Group created successfully",
      data: group,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to create group",
    });
  }
});

// ========================== GET ALL GROUPS ==========================
export const getAllGroupsController = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const groups = await getAllGroups();
    if (!groups.length) {
      return res.status(404).json({ message: "No groups found" });
    }

    return res.status(200).json({ count: groups.length, data: groups });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch groups",
    });
  }
});

// ========================== GET GROUP BY ID ==========================
export const getGroupByIdController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params as Record<string, string>;
    const group = await getGroupById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    return res.status(200).json({ data: group });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch group",
    });
  }
});

// ========================== UPDATE GROUP ==========================
export const updateGroupController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params as Record<string, string>;
    const parsed = groupChatValidator.partial().safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const updated = await updateGroup(groupId, parsed.data);
    if (!updated) {
      return res.status(404).json({ error: "Group not found" });
    }

    return res.status(200).json({
      message: "Group updated successfully",
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to update group",
    });
  }
});

// ========================== DELETE GROUP ==========================
export const deleteGroupController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params as Record<string, string>;
    const deleted = await deleteGroup(groupId);

    if (!deleted) {
      return res.status(404).json({ error: "Group not found" });
    }

    return res.status(200).json({
      message: "Group deleted successfully",
      data: deleted,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to delete group",
    });
  }
});

// ========================== ADD MEMBER ==========================
export const addGroupMemberController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params as Record<string, string>;
    const { userId, role } = req.body;

    const member = await addGroupMember({
      groupId,
      userId,
      role,
      joinedAt: new Date(),
    });

    return res.status(201).json({
      message: "Member added successfully",
      data: member,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to add member",
    });
  }
});

// ========================== REMOVE MEMBER ==========================
export const removeGroupMemberController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params as Record<string, string>;
    const removed = await removeGroupMember(groupId, userId);

    if (!removed) {
      return res.status(404).json({ error: "Member not found in group" });
    }

    return res.status(200).json({ message: "Member removed successfully" });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to remove member",
    });
  }
});

// ========================== UPDATE MEMBER ROLE ==========================
export const updateMemberRoleController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId, userId } = req.params as Record<string, string>;
    const { role } = req.body;

    const updated = await updateMemberRole(groupId, userId, role);
    if (!updated) {
      return res.status(404).json({ error: "Member not found" });
    }

    return res.status(200).json({
      message: "Member role updated successfully",
      data: updated,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to update member role",
    });
  }
});

// ========================== GET GROUP MEMBERS ==========================
export const getGroupMembersController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params as Record<string, string>;
    const members = await getGroupMembers(groupId);

    return res.status(200).json({ count: members.length, data: members });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch members",
    });
  }
});

// ========================== SEND GROUP MESSAGE ==========================
export const sendGroupMessageController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) {
      return res.status(401).json({ error: "Unauthorized: Login required" });
    }

    const parsed = groupMessageValidator.safeParse({ ...req.body, senderId });
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }

    const message = await sendGroupMessage(parsed.data);
    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to send message",
    });
  }
});

// ========================== GET GROUP MESSAGES ==========================
export const getGroupMessagesController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params as Record<string, string>;
    const messages = await getGroupMessages(groupId);

    return res.status(200).json({ count: messages.length, data: messages });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message || "Failed to fetch group messages",
    });
  }
});
