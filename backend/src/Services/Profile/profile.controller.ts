import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import {
    discoveryPreferencesValidator,
    userInterestedInValidator,
    userInterestsValidator,
    userLanguagesValidator,
    userPersonalityTraitsValidator,
    userValidator,
} from "../../Validators/users.vslidator";
import {
    getAllInterests,
    getAllLanguages,
    getAllPersonalityTraits,
    getFullProfile,
    requestPhoneOtp,
    setDiscoveryPreferences,
    setUserInterestedIn,
    setUserInterests,
    setUserLanguages,
    setUserLocation,
    setUserPersonalityTraits,
    updateProfile,
    verifyPhoneOtp,
} from "./profile.service";

// ========================== GET OWN PROFILE ==========================
export const getMyProfileController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const profile = await getFullProfile(userId);
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        res.status(200).json({ data: profile });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch profile" });
    }
});

// ========================== GET ANY USER'S PROFILE ==========================
export const getUserProfileController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const { userId } = req.params as Record<string, string>;
        const profile = await getFullProfile(userId);
        if (!profile) return res.status(404).json({ error: "User not found" });

        res.status(200).json({ data: profile });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch profile" });
    }
});

// ========================== UPDATE CORE PROFILE ==========================
export const updateProfileController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = userValidator
            .partial()
            .omit({ passwordHash: true, email: true, role: true, isSuspended: true, suspendedUntil: true })
            .safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.flatten() });
        }

        const updated = await updateProfile(userId, parsed.data as any);
        res.status(200).json({ message: "Profile updated", data: updated });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to update profile" });
    }
});

// ========================== SET LANGUAGES ==========================
export const setLanguagesController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = userLanguagesValidator.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

        await setUserLanguages(userId, parsed.data.languageIds);
        res.status(200).json({ message: "Languages updated" });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to update languages" });
    }
});

// ========================== SET PERSONALITY TRAITS ==========================
export const setPersonalityTraitsController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = userPersonalityTraitsValidator.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

        await setUserPersonalityTraits(userId, parsed.data.traitIds);
        res.status(200).json({ message: "Personality traits updated" });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to update personality traits" });
    }
});

// ========================== SET INTERESTED IN ==========================
export const setInterestedInController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = userInterestedInValidator.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

        await setUserInterestedIn(userId, parsed.data.genders);
        res.status(200).json({ message: "Interested-in preferences updated" });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to update interested-in preferences" });
    }
});

// ========================== SET LOCATION ==========================
export const setLocationController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { country, city } = req.body;
        if (!country || !city) {
            return res.status(400).json({ error: "country and city are required" });
        }

        const location = await setUserLocation(userId, {
            country: String(country).trim(),
            city: String(city).trim(),
        });
        res.status(200).json({ message: "Location updated", data: location });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to update location" });
    }
});

// ========================== SET DISCOVERY PREFERENCES ==========================
export const setDiscoveryPreferencesController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = discoveryPreferencesValidator.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

        const result = await setDiscoveryPreferences(userId, parsed.data);
        res.status(200).json({ message: "Discovery preferences updated", data: result });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to update discovery preferences" });
    }
});

// ========================== LIST LANGUAGES (for frontend dropdowns) ==========================
export const listLanguagesController = asyncHandler(async (_req: Request, res: Response) => {
    try {
        const data = await getAllLanguages();
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch languages" });
    }
});

// ========================== LIST PERSONALITY TRAITS (for frontend dropdowns) ==========================
export const listPersonalityTraitsController = asyncHandler(async (_req: Request, res: Response) => {
    try {
        const data = await getAllPersonalityTraits();
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch personality traits" });
    }
});

// ========================== SET INTERESTS ==========================
export const setInterestsController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const parsed = userInterestsValidator.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

        await setUserInterests(userId, parsed.data.interestIds);
        res.status(200).json({ message: "Interests updated" });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to update interests" });
    }
});

// ========================== LIST INTERESTS (for frontend dropdowns) ==========================
export const listInterestsController = asyncHandler(async (_req: Request, res: Response) => {
    try {
        const data = await getAllInterests();
        res.status(200).json({ data });
    } catch (error: any) {
        res.status(500).json({ error: error.message || "Failed to fetch interests" });
    }
});

// ========================== REQUEST PHONE OTP ==========================
export const requestPhoneOtpController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { phoneNumber } = req.body;
        if (!phoneNumber || typeof phoneNumber !== "string") {
            return res.status(400).json({ error: "phoneNumber is required" });
        }
        const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;
        if (!phoneRegex.test(phoneNumber.trim())) {
            return res.status(400).json({ error: "Invalid phone number format" });
        }

        const result = await requestPhoneOtp(userId, phoneNumber.trim());
        res.status(200).json({
            message: "OTP sent to your phone number",
            ...(result.devCode !== undefined && { devCode: result.devCode }),
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to send OTP" });
    }
});

// ========================== VERIFY PHONE OTP ==========================
export const verifyPhoneOtpController = asyncHandler(async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const { code } = req.body;
        if (!code || typeof code !== "string") {
            return res.status(400).json({ error: "code is required" });
        }

        await verifyPhoneOtp(userId, code.trim());
        res.status(200).json({ message: "Phone number verified successfully! ✅" });
    } catch (error: any) {
        res.status(400).json({ error: error.message || "Failed to verify OTP" });
    }
});
