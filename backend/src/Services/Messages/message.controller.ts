import { logger } from "../../utils/logger";
import { Request, Response } from "express";
import { ResponseHandler } from "../../utils/responseHandler";
import { MessageService } from "./message.service";

export class MessageController {
    private readonly messageService: MessageService;

    constructor() {
        this.messageService = new MessageService();
    }

    sendMessage = async (req: Request, res: Response) => {
        try {
            const { receiverId, content, mediaUrl, mediaType, tempId } = req.body;
            const senderId = (req as any).user.id;

            if (!receiverId || !content) {
                return res.status(400).json({
                    success: false,
                    message: "Receiver ID and content are required",
                });
            }

            const message = await this.messageService.sendMessage({
                senderId,
                receiverId,
                content,
                mediaUrl,
                mediaType,
                tempId,
            });

            return ResponseHandler.created(res, "Message sent successfully", message);
        } catch (error: any) {
            logger.error("Send message error:", error);
            return ResponseHandler.badGateway(res, error.message || "Failed to send message");
        }
    };

    updateMessageStatus = async (req: Request, res: Response) => {
        try {
            const { messageId } = req.params as Record<string, string>;
            const { status } = req.body;
            const userId = (req as any).user.id;

            if (!status || !["DELIVERED", "READ"].includes(status)) {
                return ResponseHandler.badRequest(res, "Invalid status value");
            }

            const message = await this.messageService.updateMessageStatus({
                messageId,
                status,
                userId,
            });

            return ResponseHandler.ok(res, "Message status updated successfully", message);
        } catch (error: any) {
            logger.error("Update message status error:", error);
            return ResponseHandler.badGateway(res, error.message || "Failed to update message status");
        }
    };

    markConversationAsRead = async (req: Request, res: Response) => {
        try {
            const { otherUserId } = req.params as Record<string, string>;
            const userId = (req as any).user.id;

            const messages = await this.messageService.markConversationAsRead(
                userId,
                otherUserId
            );

            return ResponseHandler.ok(res, "Conversation marked as read", messages);
        } catch (error: any) {
            logger.error("Mark conversation as read error:", error);
            return ResponseHandler.badGateway(res, error.message || "Failed to mark conversation as read");
        }
    };

    getConversation = async (req: Request, res: Response) => {
        try {
            const { otherUserId } = req.params as Record<string, string>;
            const userId = (req as any).user.id;
            const limit = Number.parseInt(req.query.limit as string) || 50;
            const offset = Number.parseInt(req.query.offset as string) || 0;

            const conversation = await this.messageService.getConversation(
                userId,
                otherUserId,
                limit,
                offset
            );

            return ResponseHandler.ok(res, "Conversation retrieved successfully", conversation);
        } catch (error: any) {
            logger.error("Get conversation error:", error);
            return ResponseHandler.badGateway(res, error.message || "Failed to get conversation");
        }
    };

    getConversationList = async (req: Request, res: Response) => {
        logger.info("🚀 CONTROLLER CALLED - getConversationList");
        try {
            const userId = (req as any).user.id;
            logger.info("🔍 Getting conversation list for user:", userId);

            const conversations = await this.messageService.getConversationList(userId);
            logger.info("✅ Found conversations:", conversations.length);

            return ResponseHandler.ok(res, "Conversation list retrieved successfully", conversations);
        } catch (error: any) {
            logger.error("❌ Get conversation list error:", error);
            return ResponseHandler.badGateway(res, error.message || "Failed to get conversation list");
        }
    };

    getUnreadCount = async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;
            const { otherUserId } = req.query;

            const count = await this.messageService.getUnreadCount(
                userId,
                otherUserId as string | undefined
            );

            return res.status(200).json({
                success: true,
                data: { count },
            });
        } catch (error: any) {
            logger.error("Get unread count error:", error);
            return ResponseHandler.internal(res, error.message || "Failed to get unread count");
        }
    };

    deleteMessage = async (req: Request, res: Response) => {
        try {
            const { messageId } = req.params as Record<string, string>;
            const userId = (req as any).user.id;

            await this.messageService.deleteMessage(messageId, userId);

            return ResponseHandler.ok(res, "Message deleted successfully");
        } catch (error: any) {
            logger.error("Delete message error:", error);
            return ResponseHandler.badGateway(res, error.message || "Failed to delete message");
        }
    };
}

