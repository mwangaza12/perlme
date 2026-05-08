import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";
import { logger } from "../utils/logger";

// Initialize Redis (fallback to memory if not available)
let redisClient: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL);
    logger.info(
      {
        type: "system",
        scope: "rate-limit",
        backend: "redis",
      },
      "Connected to Redis for rate limiting"
    );
  } catch (error) {
    logger.warn(
      {
        type: "system",
        scope: "rate-limit",
        backend: "memory",
        err: error instanceof Error ? error : undefined,
      },
      "Redis unavailable, falling back to in-memory rate limiting"
    );
  }
}

const env = (key: string, fallback: number) =>
  parseInt(process.env[key] ?? String(fallback), 10);

// Values are read once at startup; changing them requires a process restart.
const RATE_LIMIT_CONFIGS = {
  api: {
    user:  { points: env("RATE_LIMIT_API_USER_POINTS", 60),  duration: env("RATE_LIMIT_API_USER_DURATION", 60) },
    guest: { points: env("RATE_LIMIT_API_GUEST_POINTS", 30), duration: env("RATE_LIMIT_API_GUEST_DURATION", 60) },
  },
  auth: {
    login:         { points: env("RATE_LIMIT_LOGIN_POINTS", 5),          duration: env("RATE_LIMIT_LOGIN_DURATION", 900) },
    registration:  { points: env("RATE_LIMIT_REGISTRATION_POINTS", 3),   duration: env("RATE_LIMIT_REGISTRATION_DURATION", 3600) },
    passwordReset: { points: env("RATE_LIMIT_PASSWORD_RESET_POINTS", 3), duration: env("RATE_LIMIT_PASSWORD_RESET_DURATION", 3600) },
    verification:  { points: env("RATE_LIMIT_VERIFICATION_POINTS", 10),  duration: env("RATE_LIMIT_VERIFICATION_DURATION", 900) },
  },
};

// Helper to create limiter (Redis or Memory fallback)
const createLimiter = (points: number, duration: number) => {
  if (redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      points,
      duration,
    });
  }
  return new RateLimiterMemory({ points, duration });
};

// Create limiters for general API
const userLimiter = createLimiter(
  RATE_LIMIT_CONFIGS.api.user.points,
  RATE_LIMIT_CONFIGS.api.user.duration
);

const guestLimiter = createLimiter(
  RATE_LIMIT_CONFIGS.api.guest.points,
  RATE_LIMIT_CONFIGS.api.guest.duration
);

// Create limiters for auth endpoints
const loginLimiter = createLimiter(
  RATE_LIMIT_CONFIGS.auth.login.points,
  RATE_LIMIT_CONFIGS.auth.login.duration
);

const registrationLimiter = createLimiter(
  RATE_LIMIT_CONFIGS.auth.registration.points,
  RATE_LIMIT_CONFIGS.auth.registration.duration
);

const passwordResetLimiter = createLimiter(
  RATE_LIMIT_CONFIGS.auth.passwordReset.points,
  RATE_LIMIT_CONFIGS.auth.passwordReset.duration
);

const verificationLimiter = createLimiter(
  RATE_LIMIT_CONFIGS.auth.verification.points,
  RATE_LIMIT_CONFIGS.auth.verification.duration
);

/**
 * Get client identifier with proper IP handling
 */
const getClientIdentifier = (req: Request, userId?: string): string => {
  if (userId) {
    return `user:${userId}`;
  }

  // Proper IP extraction (handles proxies)
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0])
    : req.socket.remoteAddress || req.ip;

  return `ip:${ip || "unknown"}`;
};

/**
 * Generic rate limiter middleware factory
 */
const createRateLimiterMiddleware = (
  limiter: RateLimiterMemory | RateLimiterRedis,
  limitName: string
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Extract user ID from verified JWT (not from headers - security!)
    const userId = (req as any).user?.id; // Assuming auth middleware sets req.user
    const identifier = getClientIdentifier(req, userId);

    try {
      const result = await limiter.consume(identifier);

      // Add rate limit headers
      res.setHeader("X-RateLimit-Limit", limiter.points);
      res.setHeader("X-RateLimit-Remaining", result.remainingPoints);
      res.setHeader("X-RateLimit-Reset", new Date(Date.now() + result.msBeforeNext).toISOString());

      logger.info(
        {
          type: "security",
          action: "rate-limit-allow",
          scope: limitName,
          identifier,
          remaining: result.remainingPoints,
          requestId: (req as any).requestId,
        },
        "Rate limit OK"
      );

      next();
    } catch (err) {
      const rlErr = err as RateLimiterRes;
      const retrySec = Math.ceil(rlErr.msBeforeNext / 1000);

      res.setHeader("Retry-After", retrySec);
      res.setHeader("X-RateLimit-Limit", limiter.points);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", new Date(Date.now() + rlErr.msBeforeNext).toISOString());

      logger.warn(
        {
          type: "security",
          action: "rate-limit-block",
          scope: limitName,
          identifier,
          retryAfterSeconds: retrySec,
          requestId: (req as any).requestId,
        },
        "Rate limit exceeded"
      );

      return res.status(429).json({
        error: `Too many ${limitName} attempts. Please try again later.`,
        retryAfter: retrySec,
      });
    }
  };
};

/**
 * General API rate limiter (your existing one, improved)
 */
export const rateLimiterMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const userId = (req as any).user?.id;
  const identifier = getClientIdentifier(req, userId);
  const limiter = userId ? userLimiter : guestLimiter;

  try {
    const result = await limiter.consume(identifier);

    res.setHeader("X-RateLimit-Limit", limiter.points);
    res.setHeader("X-RateLimit-Remaining", result.remainingPoints);
    res.setHeader("X-RateLimit-Reset", new Date(Date.now() + result.msBeforeNext).toISOString());

    logger.info(
        {
          type: "security",
          action: "rate-limit-allow",
          scope: "api",
          identifier,
          remaining: result.remainingPoints,
          requestId: (req as any).requestId,
        },
        "Rate limit OK"
      );

    next();
  } catch (err) {
    const rlErr = err as RateLimiterRes;
    const retrySec = Math.ceil(rlErr.msBeforeNext / 1000);

    res.setHeader("Retry-After", retrySec);
    res.setHeader("X-RateLimit-Limit", limiter.points);
    res.setHeader("X-RateLimit-Remaining", 0);

    logger.warn(
      {
        type: "security",
        action: "rate-limit-block",
        scope: "api",
        identifier,
        retryAfterSeconds: retrySec,
        requestId: (req as any).requestId,
      },
      "Rate limit exceeded"
    );

    return res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfter: retrySec,
    });
  }
};

/**
 * Auth-specific rate limiters (STRICT)
 */
export const authLoginLimiter = createRateLimiterMiddleware(loginLimiter, "login");
export const authRegistrationLimiter = createRateLimiterMiddleware(registrationLimiter, "registration");
export const authPasswordResetLimiter = createRateLimiterMiddleware(passwordResetLimiter, "password-reset");
export const authVerificationLimiter = createRateLimiterMiddleware(verificationLimiter, "verification");
