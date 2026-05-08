import bcrypt from "bcrypt";
import { RequestHandler } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { sendEmail } from "../Services/email/EmailService";
import {
  loginUserValidator,
  registerUserValidator,
} from "../Validators/Auth.validator";
import { TInsertUser } from "../drizzle/schema";
import { logger } from "../utils/logger";
import {
  generateAndSetNewConfirmationCode,
  getUserByEmailService,
  getUserByIdService,
  incrementFailedLoginAttempts,
  lockAccount,
  registerUserService,
  resetFailedLoginAttempts,
  updateUserPasswordService,
  updateVerificationStatusService,
} from "./Auth.service";

// --------------------------- CONSTANTS ---------------------------
const BCRYPT_ROUNDS = 10;
const JWT_ACCESS_EXPIRY = "15m";
const JWT_REFRESH_EXPIRY = "7d";
const MAX_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION = 15 * 60 * 1000; // 15 minutes
const VERIFICATION_CODE_LENGTH = 8;
const VERIFICATION_CODE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// --------------------------- HELPERS ---------------------------
const getJWTSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters!");
  }
  return secret;
};

const getJWTRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_REFRESH_SECRET must be at least 32 characters!");
  }
  return secret;
};

// Validate secrets on module load (fail fast)
try {
  getJWTSecret();
  getJWTRefreshSecret();
} catch (error) {
  logger.error("❌ JWT secrets validation failed:", error);
  process.exit(1);
}

const generateSecureVerificationCode = (length: number = VERIFICATION_CODE_LENGTH): string => {
  const digits = "0123456789";
  let code = "";
  // Use rejection sampling to avoid modulo bias when mapping bytes to digits
  const charsetLength = digits.length; // 10
  const maxUnbiasedValue = Math.floor(256 / charsetLength) * charsetLength; // 250

  while (code.length < length) {
    const randomBytes = crypto.randomBytes(1);
    const byte = randomBytes[0];

    if (byte >= maxUnbiasedValue) {
      continue; // discard biased values
    }

    code += digits[byte % charsetLength];
  }

  return code;
};

const secureCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const generateTokenPair = (userId: string, email: string, role: string, username: string) => {
  const payload = { id: userId, email, role, username };

  const accessToken = jwt.sign(payload, getJWTSecret(), {
    expiresIn: JWT_ACCESS_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { id: userId, type: "refresh" },
    getJWTRefreshSecret(),
    { expiresIn: JWT_REFRESH_EXPIRY }
  );

  return { accessToken, refreshToken };
};

// 🌈 Base Email Template
export const baseEmailTemplate = (
  title: string,
  message: string,
  buttonText?: string,
  buttonLink?: string
) => `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: auto; background: white; padding: 30px; border-radius: 10px;">
    <h1 style="color: #9333ea;">${title}</h1>
    <div style="color: #333; line-height: 1.6;">${message}</div>
    ${buttonText && buttonLink
    ? `<a href="${buttonLink}" style="display: inline-block; margin-top: 20px; padding: 12px 24px; background: #9333ea; color: white; text-decoration: none; border-radius: 5px;">${buttonText}</a>`
    : ""
  }
    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      💜 With love,<br>The PerlMe Team<br>
      © ${new Date().getFullYear()} PerlMe
    </p>
  </div>
</body>
</html>
`;

// --------------------------- REGISTER ---------------------------
export const registerUser = asyncHandler(async (req, res) => {
  try {
    logger.info("📥 [BACKEND] Received registration request body:", JSON.stringify(req.body, null, 2));

    const parseResult = registerUserValidator.safeParse(req.body);
    if (!parseResult.success) {
      logger.error("❌ [BACKEND] Validation failed:", parseResult.error.issues);
      return res.status(400).json({ error: parseResult.error.issues });
    }

    logger.info("✅ [BACKEND] Validation passed. Parsed data:", JSON.stringify(parseResult.data, null, 2));

    const userData = parseResult.data;

    const existingUser = await getUserByEmailService(userData.email);
    if (existingUser) {
      return res.status(400).json({
        error: "Registration failed. Please try a different email.",
      });
    }

    const hashedPassword = await bcrypt.hash(userData.password, BCRYPT_ROUNDS);
    const confirmationCode = generateSecureVerificationCode();
    const confirmationCodeExpiresAt = new Date(
      Date.now() + VERIFICATION_CODE_EXPIRY
    );

    const validRoles = ["REGULAR", "CREATOR", "MODERATOR", "ADMIN"];
    const userRole =
      userData.role && validRoles.includes(userData.role)
        ? userData.role
        : "REGULAR";

    const newUserPayload: TInsertUser = {
      username: userData.username,
      email: userData.email.toLowerCase(),
      passwordHash: hashedPassword,
      dateOfBirth: userData.dateOfBirth,
      gender: userData.gender,
      orientation: userData.orientation,
      bio: userData.bio ?? null,
      avatarUrl: userData.avatarUrl ?? null,
      coverPhotoUrl: userData.coverPhotoUrl ?? null,
      confirmationCode,
      confirmationCodeExpiresAt,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: userRole,
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    };

    const newUser = await registerUserService(newUserPayload);

    // ✉️ Welcome & Verification Email
    const message = `
      Hey ${userData.username}, welcome to PerlMe! 💫<br><br>
      To activate your account, use the ${VERIFICATION_CODE_LENGTH}-digit verification code below (valid for 10 minutes):<br><br>
      <div style="font-size: 32px; font-weight: bold; color: #9333ea; letter-spacing: 4px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
        ${confirmationCode}
      </div><br>
      Enter this code in the app to verify your account and join our lovely community 💞
    `;
    const html = baseEmailTemplate("Welcome to PerlMe 💌", message);

    // Fire and forget — don't block the response waiting for the email
    sendEmail({
      to: userData.email,
      subject: "💜 Welcome to PerlMe — Verify Your Email!",
      html,
    }).catch((err) => logger.error("Failed to send registration email:", err));

    res.status(201).json({
      message: `User registered successfully. Please check your email for verification code 💌`,
      userId: newUser.id,
    });
  } catch (error: any) {
    logger.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed. Please try again later.",
    });
  }
});

// --------------------------- LOGIN ---------------------------
export const loginUser = asyncHandler(async (req, res) => {
  try {
    logger.info("📥 [BACKEND] Received login request:", JSON.stringify(req.body, null, 2));

    const parseResult = loginUserValidator.safeParse(req.body);
    if (!parseResult.success) {
      logger.error("❌ [BACKEND] Login validation failed:", parseResult.error.issues);
      return res.status(400).json({ error: parseResult.error.issues });
    }

    const { email, password } = parseResult.data;
    const normalizedEmail = email.toLowerCase();

    const user = await getUserByEmailService(normalizedEmail);

    const userExists = !!user;
    const passwordToCompare = userExists
      ? user!.passwordHash
      : "$2b$12$invalidhashtopreventtimingattack1234567890";

    const passwordValid = await bcrypt.compare(password, passwordToCompare);

    if (!userExists || !passwordValid) {
      if (userExists) {
        await incrementFailedLoginAttempts(user!.id);

        const failedAttempts = (user!.failedLoginAttempts || 0) + 1;
        if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
          await lockAccount(user!.id, ACCOUNT_LOCK_DURATION);
          return res.status(429).json({
            error: "Too many failed login attempts. Account locked for 15 minutes.",
          });
        }
      }

      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    if (user.accountLockedUntil && new Date() < new Date(user.accountLockedUntil)) {
      return res.status(423).json({
        error: "Account is temporarily locked. Please try again later.",
      });
    }

    if (!user.isVerified) {
      logger.warn("⚠️ [BACKEND] User not verified:", user.email);
      return res.status(403).json({
        error: "Please verify your email first 💌",
      });
    }

    logger.info("✅ [BACKEND] User verification checks passed");
    await resetFailedLoginAttempts(user.id);

    const { accessToken, refreshToken } = generateTokenPair(
      user.id,
      user.email,
      user.role,
      user.username
    );

    logger.info("✅ [BACKEND] Login successful for user:", user.username);
    logger.info("🔑 [BACKEND] Generated tokens - accessToken length:", accessToken.length, "refreshToken length:", refreshToken.length);

    const responseData = {
      message: "Welcome back to PerlMe 💜",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };

    logger.info("📤 [BACKEND] Sending login response:", JSON.stringify({ ...responseData, accessToken: "***", refreshToken: "***" }, null, 2));

    res.status(200).json(responseData);
  } catch (error: any) {
    logger.error("Login error:", error);
    res.status(500).json({
      error: "Login failed. Please try again later.",
    });
  }
});

// --------------------------- REFRESH TOKEN ---------------------------
export const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const payload = jwt.verify(refreshToken, getJWTRefreshSecret()) as {
      id: string;
      type: string;
    };

    if (payload.type !== "refresh") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    const user = await getUserByIdService(payload.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const tokens = generateTokenPair(
      user.id,
      user.email,
      user.role,
      user.username
    );

    res.status(200).json({
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error: any) {
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
});

// --------------------------- PASSWORD RESET ---------------------------
export const passwordReset = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await getUserByEmailService(normalizedEmail);

    const responseMessage = "If an account exists with this email, you will receive password reset instructions 💌";

    if (!user) {
      return res.status(200).json({ message: responseMessage });
    }

    const resetToken = jwt.sign(
      { email: user.email, type: "password_reset" },
      getJWTSecret(),
      { expiresIn: "1h" }
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    const message = `
      Hi ${user.username},<br><br>
      Click below to securely reset your password. This link will expire in 1 hour for your security.<br><br>
      If you didn't request this, please ignore this email and your password will remain unchanged.
    `;
    const html = baseEmailTemplate(
      "Reset Your Password 🔒",
      message,
      "Reset Password",
      resetLink
    );

    await sendEmail({
      to: email,
      subject: "🔐 Reset Your PerlMe Password",
      html,
    });

    res.status(200).json({ message: responseMessage });
  } catch (error: any) {
    logger.error("Password reset error:", error);
    res.status(500).json({
      error: "Password reset request failed. Please try again later.",
    });
  }
});

// --------------------------- UPDATE PASSWORD ---------------------------
export const updatePassword = asyncHandler(async (req, res) => {
  try {
    const { token } = req.params as Record<string, string>;
    const { password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password required" });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const payload = jwt.verify(token, getJWTSecret()) as unknown as {
      email: string;
      type: string;
    };

    if (payload.type !== "password_reset") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    const user = await getUserByEmailService(payload.email);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await updateUserPasswordService(user.email, hashedPassword);
    await resetFailedLoginAttempts(user.id);

    const message = `
      Hey ${user.username}, your password has been successfully updated! 💪<br><br>
      If this wasn't you, please contact support immediately.
    `;
    const html = baseEmailTemplate("Password Updated Successfully 💪", message);

    await sendEmail({
      to: user.email,
      subject: "✅ Your PerlMe Password Was Changed",
      html,
    });

    res.status(200).json({
      message: "Password updated successfully 💪",
    });
  } catch (error: any) {
    logger.error("Update password error:", error);
    res.status(401).json({
      error: "Invalid or expired token",
    });
  }
});

// --------------------------- EMAIL VERIFICATION ---------------------------
export const emailVerification = asyncHandler(async (req, res) => {
  try {
    logger.info("📥 [BACKEND] Received email verification request:", JSON.stringify(req.body, null, 2));

    const { email, confirmationCode } = req.body;

    if (!email || !confirmationCode) {
      logger.error("❌ [BACKEND] Missing email or confirmation code");
      return res.status(400).json({
        error: "Email and confirmation code required",
      });
    }

    const normalizedEmail = email.toLowerCase();
    logger.info("🔍 [BACKEND] Looking up user with email:", normalizedEmail);
    const user = await getUserByEmailService(normalizedEmail);

    if (!user) {
      logger.error("❌ [BACKEND] User not found for email:", normalizedEmail);
      return res.status(404).json({ error: "User not found" });
    }

    logger.info("✅ [BACKEND] User found:", user.username);
    logger.info("🔍 [BACKEND] User verification status:", user.isVerified);
    logger.info("🔍 [BACKEND] Stored code:", user.confirmationCode);
    logger.info("🔍 [BACKEND] Received code:", confirmationCode);
    logger.info("🔍 [BACKEND] Code expires at:", user.confirmationCodeExpiresAt);

    if (user.isVerified) {
      logger.warn("⚠️ [BACKEND] Email already verified");
      return res.status(400).json({ error: "Email already verified" });
    }

    if (
      !user.confirmationCode ||
      !user.confirmationCodeExpiresAt ||
      new Date() > new Date(user.confirmationCodeExpiresAt)
    ) {
      logger.error("❌ [BACKEND] Verification code expired");
      return res.status(400).json({
        error: "Verification code expired ⏰. Please request a new one.",
      });
    }

    if (!secureCompare(user.confirmationCode, confirmationCode)) {
      logger.error("❌ [BACKEND] Invalid verification code");
      return res.status(400).json({ error: "Invalid verification code" });
    }

    logger.info("✅ [BACKEND] Verification code matches! Updating user...");
    await updateVerificationStatusService(user.email, true, null);
    logger.info("✅ [BACKEND] User verified successfully");

    const message = `
      Hi ${user.username}, your email has been successfully verified 💜<br><br>
      You can now log in and start exploring connections on PerlMe!
    `;
    const html = baseEmailTemplate(
      "Email Verified Successfully 💌",
      message,
      "Go to PerlMe",
      `${process.env.FRONTEND_URL}/login`
    );

    await sendEmail({
      to: user.email,
      subject: "🎉 Your Email is Verified — Welcome to PerlMe!",
      html,
    });

    res.status(200).json({
      message: "Email verified successfully 💜",
    });
  } catch (error: any) {
    logger.error("Email verification error:", error);
    res.status(500).json({
      error: "Email verification failed. Please try again.",
    });
  }
});

// --------------------------- RESEND VERIFICATION EMAIL ---------------------------
export const resendVerificationEmail = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await getUserByEmailService(normalizedEmail);

    if (!user) {
      return res.status(200).json({
        message: "If your account exists, a new verification code has been sent 💌",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: "Email already verified" });
    }

    const newCode = await generateAndSetNewConfirmationCode(email);

    const message = `
      Hey ${user.username},<br><br>
      Here's your new ${VERIFICATION_CODE_LENGTH}-digit verification code (valid for 10 minutes):<br><br>
      <div style="font-size: 32px; font-weight: bold; color: #9333ea; letter-spacing: 4px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">
        ${newCode}
      </div><br>
      Please verify your email to activate your account 💜
    `;
    const html = baseEmailTemplate("Your New Verification Code 💫", message);

    await sendEmail({
      to: email,
      subject: "🔁 New Verification Code for PerlMe",
      html,
    });

    res.status(200).json({
      message: "If your account exists, a new verification code has been sent 💌",
    });
  } catch (error: any) {
    logger.error("Resend verification error:", error);
    res.status(500).json({
      error: "Failed to resend verification email. Please try again.",
    });
  }
});

