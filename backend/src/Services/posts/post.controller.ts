import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { logger } from "../../utils/logger";
import { PaginationHandler } from "../../utils/paginationHandler";
import { ResponseHandler } from "../../utils/responseHandler";
import { createNotification } from "../Notifications/notification.service";
import {
    commentOnPostService,
    createPostService,
    deletePostService,
    getAllPublicPostsService,
    getPostByIdService,
    getPostsByUserService,
    likePostService,
    repostService,
    unlikePostService,
    updatePostService,
} from "./post.service";

export const createPostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) return ResponseHandler.unauthorized(res);

        const { content, media } = req.body;
        if (!content?.trim()) return ResponseHandler.badRequest(res, "Post content is required");

        const mediaItems = Array.isArray(media)
            ? media.map((item) => ({
                url: item.url,
                type: item.type || "image",
            }))
            : [];

        const newPost = await createPostService({ authorId: userId, content: content.trim() }, mediaItems);
        return ResponseHandler.created(res, "Post created successfully", newPost);
    } catch (error) {
        logger.error("Error creating post:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const getAllPublicPostsController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        logger.info("[Posts] getAllPublicPosts — userId:", userId ?? "(unauthenticated)", "query:", req.query);

        const { page, limit, sortBy, sortOrder } = PaginationHandler.parseParams(req.query);

        const { data: posts, meta } = await getAllPublicPostsService(
            userId,
            page,
            limit,
            sortBy,
            sortOrder
        );

        logger.info("[Posts] Returning", posts.length, "posts (total:", meta.totalItems, ")");
        return PaginationHandler.send(res, posts, meta.totalItems, page, limit);
    } catch (error) {
        logger.error("Error fetching posts:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});


export const getPostByIdController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { postId } = req.params as Record<string, string>;
        const userId = req.user?.id;
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");

        const post = await getPostByIdService(postId, userId);
        if (!post) return ResponseHandler.notFound(res, "Post not found");

        return ResponseHandler.ok(res, "Post fetched successfully", post);
    } catch (error) {
        logger.error("Error fetching post:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const getPostsByUserController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { userId: targetUserId } = req.params as Record<string, string>;
        const currentUserId = req.user?.id;

        if (!targetUserId) return ResponseHandler.badRequest(res, "User ID is required");

        const { page, limit, sortBy, sortOrder } = PaginationHandler.parseParams(req.query);

        const paginatedResult = await getPostsByUserService(
            targetUserId,
            currentUserId,
            page,
            limit,
            sortBy,
            sortOrder
        );

        return PaginationHandler.send(
            res,
            paginatedResult.data,
            paginatedResult.meta.totalItems,
            page,
            limit,
            "User posts fetched successfully"
        );
    } catch (error) {
        logger.error("Error fetching user posts:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});


export const updatePostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postId } = req.params as Record<string, string>;
        const { content } = req.body;

        if (!userId) return ResponseHandler.unauthorized(res);
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");
        if (!content?.trim()) return ResponseHandler.badRequest(res, "Post content is required");

        const updatedPost = await updatePostService(postId, userId, content.trim());
        if (!updatedPost) return ResponseHandler.notFound(res, "Post not found or not owned by user");

        return ResponseHandler.ok(res, "Post updated successfully", updatedPost);
    } catch (error) {
        logger.error("Error updating post:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const deletePostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { postId } = req.params as Record<string, string>;
        const userId = req.user?.id;

        if (!userId) return ResponseHandler.unauthorized(res);
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");

        const deleted = await deletePostService(postId, userId);
        if (!deleted) return ResponseHandler.notFound(res, "Post not found or not owned by user");

        return ResponseHandler.ok(res, "Post deleted successfully");
    } catch (error) {
        logger.error("Error deleting post:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const likePostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postId } = req.params as Record<string, string>;

        if (!userId) return ResponseHandler.unauthorized(res);
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");

        await likePostService(userId, postId);

        // Notify the post author (fire-and-forget)
        getPostByIdService(postId, userId).then((post) => {
            if (post?.authorId && post.authorId !== userId) {
                createNotification(userId, post.authorId, "LIKE", "liked your post", postId).catch(() => { });
            }
        }).catch(() => { });

        return ResponseHandler.ok(res, "Post liked successfully");
    } catch (error) {
        logger.error("Error liking post:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const unlikePostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postId } = req.params as Record<string, string>;

        if (!userId) return ResponseHandler.unauthorized(res);
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");

        await unlikePostService(userId, postId);
        return ResponseHandler.ok(res, "Post unliked successfully");
    } catch (error) {
        logger.error("Error unliking post:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const commentOnPostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postId } = req.params as Record<string, string>;
        const { content } = req.body;

        if (!userId) return ResponseHandler.unauthorized(res);
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");
        if (!content?.trim()) return ResponseHandler.badRequest(res, "Comment content required");

        const comment = await commentOnPostService(userId, postId, content.trim());

        // Notify the post author (fire-and-forget)
        getPostByIdService(postId, userId).then((post) => {
            if (post?.authorId && post.authorId !== userId) {
                createNotification(userId, post.authorId, "COMMENT", "commented on your post", postId).catch(() => { });
            }
        }).catch(() => { });

        return ResponseHandler.created(res, "Comment added successfully", comment);
    } catch (error) {
        logger.error("Error adding comment:", error);
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

export const repostController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { postId } = req.params as Record<string, string>;

        if (!userId) return ResponseHandler.unauthorized(res);
        if (!postId) return ResponseHandler.badRequest(res, "Post ID is required");

        const repost = await repostService(userId, postId);
        return ResponseHandler.created(res, "Post shared to your feed", repost);
    } catch (error: any) {
        logger.error("Error reposting:", error);
        if (error.message === "Original post not found") {
            return ResponseHandler.notFound(res, error.message);
        }
        return ResponseHandler.internal(res, "Internal server error", error);
    }
});

