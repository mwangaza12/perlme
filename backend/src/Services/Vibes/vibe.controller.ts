import type { Request, Response } from "express";
import type { VibeType } from "../../drizzle/schema";
import { VibeService } from "./vibe.service";

const vibeService = new VibeService();

// All 12 valid vibe types — used for input validation without a Zod dep here
const VALID_VIBE_TYPES = new Set<string>([
    "SOCIAL_BUTTERFLY", "SOLO_ADVENTURER", "DEEP_DIVER",
    "INSTANT_MATCH", "SLOW_BURNER", "EVENING_STAR",
    "CAFFEINE_CRITIC", "NIGHT_OWL", "ACTIVITY_JUNKIE",
    "WITTY_ONE", "WHOLESOME", "MEME_DEALER",
]);

export class VibeController {

    /**
     * POST /api/vibes/:targetUserId
     * Body: { vibeType: VibeType }
     */
    castVibe = async (req: Request, res: Response): Promise<void> => {
        const voterId = (req as any).user?.id as string;
        const { targetUserId } = req.params as Record<string, string>;
        const { vibeType } = req.body as { vibeType: string };

        if (!vibeType || !VALID_VIBE_TYPES.has(vibeType)) {
            res.status(400).json({ message: "Invalid vibeType" });
            return;
        }

        try {
            const result = await vibeService.castVibe(voterId, targetUserId, vibeType as VibeType);
            res.status(200).json({ message: "Vibe recorded", ...result });
        } catch (err: any) {
            const status = err.message === "You cannot vibe yourself" ? 400 : 500;
            res.status(status).json({ message: err.message });
        }
    };

    /**
     * GET /api/vibes/:targetUserId
     * Returns top vibe + all counts for a user.
     */
    getVibes = async (req: Request, res: Response): Promise<void> => {
        const { targetUserId } = req.params as Record<string, string>;
        const voterId = (req as any).user?.id as string;

        try {
            const [topVibe, allCounts, myVote] = await Promise.all([
                vibeService.getTopVibe(targetUserId),
                vibeService.getAllVibeCounts(targetUserId),
                vibeService.getMyVote(voterId, targetUserId),
            ]);

            res.status(200).json({ data: { topVibe, allCounts, myVote } });
        } catch (err: any) {
            res.status(500).json({ message: err.message });
        }
    };

    /**
     * GET /api/vibes/:targetUserId/prompt
     * Returns { show: boolean } — whether to show the vibe prompt in the conversation.
     */
    getPromptStatus = async (req: Request, res: Response): Promise<void> => {
        const userId = (req as any).user?.id as string;
        const { targetUserId } = req.params as Record<string, string>;

        try {
            const show = await vibeService.shouldShowVibePrompt(userId, targetUserId);
            res.status(200).json({ data: { show } });
        } catch (err: any) {
            res.status(500).json({ message: err.message });
        }
    };
}
