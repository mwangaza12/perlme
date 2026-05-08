import { logger } from "../utils/logger";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "node:http";
import { SocketResponseHandler } from "../utils/socketResponseHandler";
import { verify } from "jsonwebtoken";
import db  from "../drizzle/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

interface UserSocket {
    userId: string;
    socketId: string;
}

interface JWTPayload {
    userId: string;
    email: string;
}

export class SocketService {
    private readonly io: SocketIOServer;
    private readonly userSockets: Map<string, string[]> = new Map();

    constructor(server: HTTPServer) {
        const socketOrigins = (
            process.env.CORS_ALLOWED_ORIGINS ||
            process.env.CLIENT_URL ||
            "http://localhost:3000"
        )
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean);

        this.io = new SocketIOServer(server, {
            cors: {
                origin: socketOrigins.length === 1 ? socketOrigins[0] : socketOrigins,
                methods: ["GET", "POST"],
                credentials: true,
            },
            pingTimeout: 60000,
            pingInterval: 25000,
        });

        this.setupMiddleware();
        this.setupConnectionHandlers();
    }

    private setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token =
                    socket.handshake.auth.token ||
                    socket.handshake.headers.authorization?.split(" ")[1];

                if (!token) {
                    return next(
                        SocketResponseHandler.toError(
                            SocketResponseHandler.unauthorized("Authentication token required")
                        )
                    );
                }

                const decoded = verify(token, process.env.JWT_SECRET!) as JWTPayload;

                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.id, decoded.userId))
                    .limit(1);

                if (!user) {
                    return next(
                        SocketResponseHandler.toError(
                            SocketResponseHandler.notFound("User not found")
                        )
                    );
                }

                if (user.isSuspended) {
                    return next(
                        SocketResponseHandler.toError(
                            SocketResponseHandler.forbidden("Account suspended")
                        )
                    );
                }

                socket.data.userId = user.id;
                socket.data.username = user.username;

                next();
            } catch (error) {
                next(
                    SocketResponseHandler.toError(
                        SocketResponseHandler.internal("Invalid token", error)
                    )
                );
            }
        });
    }


    private setupConnectionHandlers() {
        this.io.on("connection", (socket) => {
            const userId = socket.data.userId;
            logger.info(`User connected: ${userId} (socket: ${socket.id})`);

            // Track user's socket connections (users can have multiple tabs/devices)
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, []);
            }
            this.userSockets.get(userId)!.push(socket.id);

            // Join user to their personal room
            socket.join(`user:${userId}`);

            // Emit online status to user's contacts
            this.emitUserOnline(userId);

            // Handle incoming messages
            socket.on("send_message", async (data) => {
                await this.handleSendMessage(socket, data);
            });

            // Handle message delivery acknowledgment
            socket.on("message_delivered", async (data) => {
                await this.handleMessageDelivered(socket, data);
            });

            // Handle message read acknowledgment
            socket.on("message_read", async (data) => {
                await this.handleMessageRead(socket, data);
            });

            // Handle typing indicator
            socket.on("typing", (data) => {
                this.handleTyping(socket, data);
            });

            // Handle stop typing indicator
            socket.on("stop_typing", (data) => {
                this.handleStopTyping(socket, data);
            });

            // Handle disconnection
            socket.on("disconnect", () => {
                this.handleDisconnect(socket, userId);
            });

            // Handle errors
            socket.on("error", (error) => {
                logger.error(`Socket error for user ${userId}:`, error);
            });
        });
    }

    private async handleSendMessage(socket: any, data: any) {
        // This will be handled by the message service
        // Socket just emits the event, service handles DB operations
        socket.emit("message_sent", { messageId: data.tempId, status: "processing" });
    }

    private async handleMessageDelivered(socket: any, data: { messageId: string }) {
        // Will be implemented in message service
        const userId = socket.data.userId;
        logger.info(`Message ${data.messageId} delivered to user ${userId}`);
    }

    private async handleMessageRead(socket: any, data: { messageId: string }) {
        // Will be implemented in message service
        const userId = socket.data.userId;
        logger.info(`Message ${data.messageId} read by user ${userId}`);
    }

    private handleTyping(socket: any, data: { receiverId: string }) {
        const userId = socket.data.userId;
        this.emitToUser(data.receiverId, "user_typing", {
            userId,
            username: socket.data.username,
        });
    }

    private handleStopTyping(socket: any, data: { receiverId: string }) {
        const userId = socket.data.userId;
        this.emitToUser(data.receiverId, "user_stop_typing", {
            userId,
        });
    }

    private handleDisconnect(socket: any, userId: string) {
        logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);

        // Remove this socket from user's connections
        const sockets = this.userSockets.get(userId) || [];
        const updatedSockets = sockets.filter((id) => id !== socket.id);

        if (updatedSockets.length === 0) {
            // User has no more active connections
            this.userSockets.delete(userId);
            this.emitUserOffline(userId);
        } else {
            this.userSockets.set(userId, updatedSockets);
        }
    }

    // Public methods for other services to use

    public emitToUser(userId: string, event: string, data: any) {
        this.io.to(`user:${userId}`).emit(event, data);
    }

    public emitToMultipleUsers(userIds: string[], event: string, data: any) {
        for (const userId of userIds) {
            this.emitToUser(userId, event, data);
        }
    }


    public isUserOnline(userId: string): boolean {
        return this.userSockets.has(userId);
    }

    public getOnlineUsers(): string[] {
        return Array.from(this.userSockets.keys());
    }

    private emitUserOnline(userId: string) {
        // Notify relevant users (followers, contacts, etc.)
        this.io.emit("user_online", { userId });
    }

    private emitUserOffline(userId: string) {
        // Notify relevant users
        this.io.emit("user_offline", { userId });
    }

    public getIO(): SocketIOServer {
        return this.io;
    }
}

let socketService: SocketService | null = null;

export const initializeSocketService = (server: HTTPServer): SocketService => {
    socketService ??= new SocketService(server);
    return socketService;
};


export const getSocketService = (): SocketService => {
    if (!socketService) {
        throw new Error("Socket service not initialized");
    }
    return socketService;
};

