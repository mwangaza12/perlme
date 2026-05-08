import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { logger } from "../../utils/logger";
import { PaginationHandler } from "../../utils/paginationHandler";
import { ResponseHandler } from "../../utils/responseHandler";
import {
    deleteNotification,
    getUnreadNotificationsCount,
    getUserNotifications,
    markAllNotificationsAsRead,
    markNotificationAsRead,
} from "./notification.service";

export const getNotificationsController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return ResponseHandler.unauthorized(res);

        const { page, limit } = PaginationHandler.parseParams(req.query);
        const { data, total } = await getUserNotifications(userId, page, limit);

        return ResponseHandler.ok(res, "Notifications retrieved", {
            notifications: data,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        logger.error("Error fetching notifications:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const getUnreadCountController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return ResponseHandler.unauthorized(res);

        const count = await getUnreadNotificationsCount(userId);
        return ResponseHandler.ok(res, "Unread count retrieved", { count });
    } catch (error) {
        logger.error("Error fetching unread count:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const markAsReadController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params as Record<string, string>;
        if (!userId) return ResponseHandler.unauthorized(res);
        if (!id) return ResponseHandler.badRequest(res, "Notification ID is required");

        const updated = await markNotificationAsRead(id, userId);
        if (!updated) return ResponseHandler.notFound(res, "Notification not found");

        return ResponseHandler.ok(res, "Notification marked as read", updated);
    } catch (error) {
        logger.error("Error marking notification read:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const markAllAsReadController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return ResponseHandler.unauthorized(res);

        const count = await markAllNotificationsAsRead(userId);
        return ResponseHandler.ok(res, `${count} notification(s) marked as read`, { count });
    } catch (error) {
        logger.error("Error marking all notifications read:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const deleteNotificationController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { id } = req.params as Record<string, string>;
        if (!userId) return ResponseHandler.unauthorized(res);
        if (!id) return ResponseHandler.badRequest(res, "Notification ID is required");

        const deleted = await deleteNotification(id, userId);
        if (!deleted) return ResponseHandler.notFound(res, "Notification not found");

        return ResponseHandler.ok(res, "Notification deleted");
    } catch (error) {
        logger.error("Error deleting notification:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});
