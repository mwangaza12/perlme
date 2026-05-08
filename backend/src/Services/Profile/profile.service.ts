import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import db from "../../drizzle/db";
import {
    interests,
    languages,
    locations,
    personalityTraits,
    userDiscoveryPreferences,
    userInterestedIn,
    userInterests,
    userLanguages,
    userPersonalityTraits,
    users,
} from "../../drizzle/schema";
import { smsProvider } from "../../utils/sms";
import {
    TDiscoveryPreferencesValidator,
    TUserValidator,
    userValidator,
} from "../../Validators/users.vslidator";

// ========================== GET FULL PROFILE ==========================
// Returns user with all profile-related relations for the profile screen
export const getFullProfile = async (userId: string) => {
    const profile = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.id, userId),
        with: {
            location: true,
            interests: { with: { interest: true } },
            languages: { with: { language: true } },
            personalityTraits: { with: { trait: true } },
            discoveryPreferences: true,
            interestedIn: true,
        },
    });

    if (!profile) return null;

    // Strip sensitive fields before returning
    const { passwordHash, confirmationCode, confirmationCodeExpiresAt, failedLoginAttempts, accountLockedUntil, ...safe } = profile;
    return safe;
};

// ========================== UPDATE CORE PROFILE ==========================
// Handles all scalar/enum fields on the users table
export const updateProfile = async (userId: string, updates: Partial<TUserValidator>) => {
    const validated = userValidator
        .partial()
        .omit({ passwordHash: true, email: true, role: true, isSuspended: true, suspendedUntil: true })
        .parse(updates);

    // Stamp profileCompletedAt the first time a meaningful field is saved
    const substantiveFields = [
        "bio", "pronouns", "relationshipIntention", "smoking",
        "drinking", "fitnessLevel", "educationLevel", "occupation"
    ] as const;

    const isSubstantive = substantiveFields.some(
        (f) => validated[f as keyof typeof validated] !== undefined
    );

    const [updated] = await db
        .update(users)
        .set({
            ...validated,
            ...(isSubstantive ? { profileCompletedAt: new Date() } : {}),
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning();

    return updated;
};

export const setUserLanguages = async (userId: string, languageIds: string[]) => {
    const found = await db
        .select({ id: languages.id })
        .from(languages)
        .then((rows) => rows.map((r) => r.id));

    const invalid = languageIds.filter((id) => !found.includes(id));
    if (invalid.length > 0) {
        throw new Error(`Unknown language IDs: ${invalid.join(", ")}`);
    }

    await db.transaction(async (tx) => {
        await tx.delete(userLanguages).where(eq(userLanguages.userId, userId));
        if (languageIds.length > 0) {
            await tx.insert(userLanguages).values(
                languageIds.map((languageId) => ({ userId, languageId }))
            );
        }
    });
};

// ========================== SET PERSONALITY TRAITS ==========================
// Replaces the user's personality trait list entirely (delete + insert)
export const setUserPersonalityTraits = async (userId: string, traitIds: string[]) => {
    const found = await db
        .select({ id: personalityTraits.id })
        .from(personalityTraits)
        .then((rows) => rows.map((r) => r.id));

    const invalid = traitIds.filter((id) => !found.includes(id));
    if (invalid.length > 0) {
        throw new Error(`Unknown trait IDs: ${invalid.join(", ")}`);
    }

    await db.transaction(async (tx) => {
        await tx.delete(userPersonalityTraits).where(eq(userPersonalityTraits.userId, userId));
        if (traitIds.length > 0) {
            await tx.insert(userPersonalityTraits).values(
                traitIds.map((traitId) => ({ userId, traitId }))
            );
        }
    });
};

// ========================== SET INTERESTED IN ==========================
// Replaces who the user wants to see (genders) — delete + insert
export const setUserInterestedIn = async (
    userId: string,
    genders: Array<"MALE" | "FEMALE" | "NON_BINARY" | "OTHER">
) => {
    await db.transaction(async (tx) => {
        await tx.delete(userInterestedIn).where(eq(userInterestedIn.userId, userId));
        if (genders.length > 0) {
            await tx.insert(userInterestedIn).values(
                genders.map((gender) => ({ userId, gender }))
            );
        }
    });
};

// ========================== SET DISCOVERY PREFERENCES ==========================
// Upsert — one record per user
export const setDiscoveryPreferences = async (
    userId: string,
    prefs: TDiscoveryPreferencesValidator
) => {
    const existing = await db.query.userDiscoveryPreferences.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
    });

    if (existing) {
        const [updated] = await db
            .update(userDiscoveryPreferences)
            .set({ ...prefs, updatedAt: new Date() })
            .where(eq(userDiscoveryPreferences.userId, userId))
            .returning();
        return updated;
    }

    const [created] = await db
        .insert(userDiscoveryPreferences)
        .values({ userId, ...prefs })
        .returning();
    return created;
};

// ========================== SET LOCATION ==========================
// Upsert — one row per user in locations table
export const setUserLocation = async (
    userId: string,
    data: { country: string; city: string }
) => {
    const existing = await db.query.locations.findFirst({
        where: (table, { eq }) => eq(table.userId, userId),
    });

    if (existing) {
        const [updated] = await db
            .update(locations)
            .set({ country: data.country, city: data.city, updatedAt: new Date() })
            .where(eq(locations.userId, userId))
            .returning();
        return updated;
    }

    const [created] = await db
        .insert(locations)
        .values({ userId, country: data.country, city: data.city })
        .returning();
    return created;
};

// ========================== LIST ALL LANGUAGES ==========================
export const getAllLanguages = async () => {
    return db.select().from(languages).orderBy(languages.name);
};

// ========================== LIST ALL PERSONALITY TRAITS ==========================
export const getAllPersonalityTraits = async () => {
    return db.select().from(personalityTraits).orderBy(personalityTraits.name);
};

// ========================== SET INTERESTS ==========================
export const setUserInterests = async (userId: string, interestIds: string[]) => {
    const found = await db
        .select({ id: interests.id })
        .from(interests)
        .then((rows) => rows.map((r) => r.id));

    const invalid = interestIds.filter((id) => !found.includes(id));
    if (invalid.length > 0) {
        throw new Error(`Unknown interest IDs: ${invalid.join(", ")}`);
    }

    await db.transaction(async (tx) => {
        await tx.delete(userInterests).where(eq(userInterests.userId, userId));
        if (interestIds.length > 0) {
            await tx.insert(userInterests).values(
                interestIds.map((interestId) => ({ userId, interestId }))
            );
        }
    });
};

// ========================== LIST ALL INTERESTS ==========================
export const getAllInterests = async () => {
    return db.select().from(interests).orderBy(interests.name);
};

// ========================== REQUEST PHONE OTP ==========================
export const requestPhoneOtp = async (userId: string, phoneNumber: string) => {
    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db
        .update(users)
        .set({
            phoneNumber,
            phoneConfirmationCode: code,
            phoneConfirmationCodeExpiresAt: expiresAt,
        })
        .where(eq(users.id, userId));

    await smsProvider.sendOtp(phoneNumber, code);

    // In dev/console mode the code is returned so the frontend can display it.
    // In production (Twilio/Africa's Talking) this field will be undefined.
    const devCode = process.env.SMS_PROVIDER === undefined || process.env.SMS_PROVIDER === "console"
        ? code
        : undefined;
    return { devCode };
};

// ========================== VERIFY PHONE OTP ==========================
export const verifyPhoneOtp = async (userId: string, code: string) => {
    const user = await db.query.users.findFirst({
        where: (table, { eq }) => eq(table.id, userId),
    });

    if (!user) throw new Error("User not found");
    if (!user.phoneConfirmationCode) throw new Error("No OTP pending. Request a new code.");
    if (
        user.phoneConfirmationCodeExpiresAt &&
        user.phoneConfirmationCodeExpiresAt < new Date()
    ) {
        throw new Error("OTP has expired. Please request a new one.");
    }
    if (user.phoneConfirmationCode !== code) throw new Error("Invalid OTP code.");

    await db
        .update(users)
        .set({
            isPhoneVerified: true,
            phoneConfirmationCode: null,
            phoneConfirmationCodeExpiresAt: null,
        })
        .where(eq(users.id, userId));
};
