import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { logger } from "../../utils/logger";
import { exploreAndRecommendValidator } from "../../Validators/Explore.validator";
import { exploreService, recommendationService } from "./exploreAndRecommendations.service";


// ========================== 🧭 EXPLORE CONTROLLER ==========================
export const exploreController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const parsed = exploreAndRecommendValidator.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.flatten(),
      });
    }

    const data = await exploreService(parsed.data);

    return res.status(200).json({
      message:
        data.posts.length || data.groups.length
          ? "Explore feed fetched successfully."
          : "No content found for explore feed.",
      data,
    });
  } catch (error: any) {
    logger.error("❌ Explore Controller Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch explore feed.",
    });
  }
});

// ========================== ❤️ RECOMMENDATION CONTROLLER ==========================
export const recommendationController = asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.info("[Recommendations] Request from user:", req.user?.id, "query:", req.query);

    const parsed = exploreAndRecommendValidator.safeParse({
      ...req.query,
      userId: req.user?.id,
    });

    if (!parsed.success) {
      logger.warn("[Recommendations] Validation failed:", parsed.error.flatten());
      return res.status(400).json({
        error: parsed.error.flatten(),
      });
    }

    const recommendations = await recommendationService(parsed.data);

    logger.info("[Recommendations] Service returned", recommendations.length, "users");

    // Return empty array (200) instead of 404 — RTK Query treats 404 as error
    // which leaves the frontend stuck with no data
    return res.status(200).json({
      message: recommendations.length
        ? "Recommendations fetched successfully."
        : "No recommendations found based on your preferences.",
      count: recommendations.length,
      data: recommendations,
    });
  } catch (error: any) {
    logger.error("❌ Recommendation Controller Error:", error);
    return res.status(500).json({
      error: error.message || "Failed to fetch recommendations.",
    });
  }
});

