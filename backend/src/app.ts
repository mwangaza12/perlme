import cors from "cors";
import express, { Application } from 'express';
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import { authRouter } from './Auth/Auth.route';
import { anyAuth } from './Middlewares/BearAuth';
import { checkUserActive } from './Middlewares/checkUserActivity';
import { requestLogger } from './Middlewares/Logger';
import { metricsMiddleware } from './Middlewares/metrics.middleware';
import { rateLimiterMiddleware } from './Middlewares/rateLimiter';
import "./Middlewares/schedule";
import { corsOptions } from './Middlewares/securityHeader.middleware';
import clientLogsRoute from "./routes/clientLogs.route";
import healthRoute from "./routes/health.route";
import metricsRoute from "./routes/metrics.route";
import blockRouters from './Services/Block/block.routes';
import { EmailProviderType, EmailServiceFactory } from './Services/email/EmailServiceFactory';
import exploreRouter from './Services/Explore and Recommendations/exploreAndRecommend.routes';
import groupRouters from './Services/Groups/group.route';
import messageRouter from './Services/Messages/message.route';
import notificationRouter from './Services/Notifications/notification.route';
import postRouter from './Services/posts/post.route';
import profileRouter from './Services/Profile/profile.route';
import reportRouters from './Services/Reports/report.route';
import uploadRouter from './Services/upload/upload.route';
import userRouters from './Services/Users/user.route';
import vibeRouter from './Services/Vibes/vibe.route';
import swaggerSpec from "./swagger";
import { logger } from "./utils/logger";

logger.info("Scheduler file loaded");

const app: Application = express();

// ============================================================================
// 🏥 HEALTH CHECK (Before other middleware)
// ============================================================================
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ===== INITIALIZE EMAIL SERVICE =====
// This should happen early in your app initialization
const emailProvider = (process.env.EMAIL_PROVIDER as EmailProviderType) || 'resend';

try {
    EmailServiceFactory.initialize(emailProvider);
    logger.info({ emailProvider }, "Email service initialized");
} catch (error) {
    logger.error({ error }, "Failed to initialize email service");
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    } else {
        logger.warn("Email service unavailable — running without email in development mode");
    }
}

// ============================================================================
// 🌐 CORS CONFIGURATION
// ============================================================================
// Use production-ready CORS config from securityHeaders.middleware
app.use(cors(corsOptions));

// ============================================================================
// 📦 BODY PARSING (with size limits to prevent DoS)
// ============================================================================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================================
// 📁 STATIC FILES (Serve uploaded media)
// ============================================================================
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ============================================================================
// 🚦 RATE LIMITING
// ============================================================================
app.use(rateLimiterMiddleware);
app.set("trust proxy", true);

// ============================================================================
// 📝 LOGGING
// ============================================================================
app.use(requestLogger);
app.use(metricsMiddleware);

// ============================================================================
// 🔧 TRUST PROXY (if behind nginx/load balancer/cloudflare)
// ============================================================================
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1); // Trust first proxy
}

// ============================================================================
// 📚 SWAGGER DOCS
// ============================================================================
app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    })
);

// ============================================================================
// 🛣️ PUBLIC ROUTES (No authentication required)
// ============================================================================
app.use('/api/auth', authRouter);
app.use('/api/discover', exploreRouter);
app.use('/api', clientLogsRoute);

// Health and Metrics routes
app.use(healthRoute);
app.use(metricsRoute);

// ============================================================================
// 🔐 PROTECTED ROUTES (Require authentication + active account)
// ============================================================================
app.use('/api', anyAuth, checkUserActive, userRouters);
app.use('/api', anyAuth, checkUserActive, postRouter);
app.use('/api/messages', anyAuth, checkUserActive, messageRouter);
app.use('/api', anyAuth, checkUserActive, groupRouters);
app.use('/api', anyAuth, checkUserActive, blockRouters);
app.use('/api', anyAuth, checkUserActive, reportRouters);
app.use('/api', anyAuth, checkUserActive, uploadRouter);
app.use('/api', anyAuth, checkUserActive, profileRouter);
app.use('/api', anyAuth, checkUserActive, notificationRouter);
app.use('/api/vibes', anyAuth, checkUserActive, vibeRouter);
// ============================================================================
// ❌ 404 HANDLER
// ============================================================================
app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
});

// ============================================================================
// 🚨 GLOBAL ERROR HANDLER
// ============================================================================
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ err }, "Unhandled error");

    // Don't expose internal error details in production
    const message = process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message;

    res.status(err.status || 500).json({
        error: message,
        ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
    });
});

export default app;
