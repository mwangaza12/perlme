import db from "../../drizzle/db";
import { groupChats, groupMembers, groupMessages, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  groupChatValidator,
  groupMemberValidator,
  groupMessageValidator,
  TGroupChatValidator,
  TGroupMemberValidator,
  TGroupMessageValidator,
  groupRoleEnum,
} from "../../Validators/Group.Validators";

// ========================== CREATE GROUP ==========================
export const createGroup = async (data: TGroupChatValidator) => {
  const validated = groupChatValidator.parse(data);

  return await db.transaction(async (tx) => {
    // ✅ Insert the new group
    const [group] = await tx.insert(groupChats).values(validated).returning();

    // ✅ Automatically make creator a GROUP_ADMIN
    await tx.insert(groupMembers).values({
      groupId: group.id,
      userId: validated.creatorId,
      role: groupRoleEnum.enum.GROUP_ADMIN,
      joinedAt: new Date(),
    });

    // ✅ Automatically add all system admins as GROUP_MODERATOR
    const systemAdmins = await tx
      .select()
      .from(users)
      .where(eq(users.role, "ADMIN"));

    if (systemAdmins.length > 0) {
      const moderatorsToAdd = systemAdmins.map((admin) => ({
        groupId: group.id,
        userId: admin.id,
        role: groupRoleEnum.enum.GROUP_MODERATOR,
        joinedAt: new Date(),
      }));

      await tx.insert(groupMembers).values(moderatorsToAdd);
    }

    return group;
  });
};

// ========================== GET ALL GROUPS ==========================
export const getAllGroups = async () => {
  return await db.select().from(groupChats);
};

// ========================== GET GROUP BY ID ==========================
export const getGroupById = async (id: string) => {
  const [group] = await db.select().from(groupChats).where(eq(groupChats.id, id));
  return group || null;
};

// ========================== UPDATE GROUP ==========================
export const updateGroup = async (id: string, updates: Partial<TGroupChatValidator>) => {
  const validated = groupChatValidator.partial().parse(updates);

  const [updatedGroup] = await db
    .update(groupChats)
    .set({ ...validated, updatedAt: new Date() })
    .where(eq(groupChats.id, id))
    .returning();

  return updatedGroup;
};

// ========================== DELETE GROUP ==========================
export const deleteGroup = async (id: string) => {
  const [deletedGroup] = await db
    .delete(groupChats)
    .where(eq(groupChats.id, id))
    .returning();

  return deletedGroup;
};

// ========================== ADD MEMBER ==========================
export const addGroupMember = async (data: TGroupMemberValidator) => {
  const validated = groupMemberValidator.parse(data);

  // Prevent duplicate membership
  const existing = await db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, validated.groupId), eq(groupMembers.userId, validated.userId)));

  if (existing.length > 0) {
    throw new Error("User is already a member of this group");
  }

  const [member] = await db
    .insert(groupMembers)
    .values({
      ...validated,
      joinedAt: new Date(),
    })
    .returning();

  return member;
};

// ========================== REMOVE MEMBER ==========================
export const removeGroupMember = async (groupId: string, userId: string) => {
  const [removed] = await db
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning();

  return removed;
};

// ========================== UPDATE MEMBER ROLE ==========================
export const updateMemberRole = async (
  groupId: string,
  userId: string,
  role: (typeof groupRoleEnum.enum)[keyof typeof groupRoleEnum.enum]
) => {
  const [updatedMember] = await db
    .update(groupMembers)
    .set({ role })
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .returning();

  return updatedMember;
};

// ========================== GET MEMBERS OF A GROUP ==========================
export const getGroupMembers = async (groupId: string) => {
  return await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
};

// ========================== SEND GROUP MESSAGE ==========================
export const sendGroupMessage = async (data: TGroupMessageValidator) => {
  const validated = groupMessageValidator.parse(data);

  const [message] = await db
    .insert(groupMessages)
    .values({
      ...validated,
      createdAt: new Date(),
    })
    .returning();

  return message;
};

// ========================== GET MESSAGES IN GROUP ==========================
export const getGroupMessages = async (groupId: string) => {
  return await db.select().from(groupMessages).where(eq(groupMessages.groupId, groupId));
};
