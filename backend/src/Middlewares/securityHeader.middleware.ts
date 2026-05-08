import { Express } from "express";
import helmet from "helmet";
import expectCt from "expect-ct"

/**
 * Apply security headers using Helmet
 * This should be called early in your Express app setup
 */
export const applySecurityHeaders = (app: Express) => {
    // Apply Helmet with secure defaults
    app.use(
        helmet({
            // Content Security Policy
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"], // Allow images from HTTPS
                    connectSrc: ["'self'"], // API calls
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                },
            },

            // Cross-Origin Embedder Policy
            crossOriginEmbedderPolicy: true,

            // Cross-Origin Opener Policy
            crossOriginOpenerPolicy: { policy: "same-origin" },

            // Cross-Origin Resource Policy
            crossOriginResourcePolicy: { policy: "same-origin" },

            // DNS Prefetch Control
            dnsPrefetchControl: { allow: false },

            // Expect-CT (handled separately below)

            // Frameguard (prevent clickjacking)
            frameguard: { action: "deny" },

            // Hide Powered-By header
            hidePoweredBy: true,

            // HTTP Strict Transport Security
            hsts: {
                maxAge: 31536000, // 1 year
                includeSubDomains: true,
                preload: true,
            },

            // IE No Open
            ieNoOpen: true,

            // Don't Sniff Mimetype
            noSniff: true,

            // Origin Agent Cluster
            originAgentCluster: true,

            // Permitted Cross-Domain Policies
            permittedCrossDomainPolicies: { permittedPolicies: "none" },

            // Referrer Policy
            referrerPolicy: { policy: "no-referrer" },

            // XSS Filter
            xssFilter: true,
        })
    );

    // Apply Expect-CT header separately
    app.use(
        expectCt({
            maxAge: 86400,
            enforce: true,
        })
    );

    // Additional custom headers
    app.use((req, res, next) => {
        // Prevent caching of sensitive data
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");

        // Feature Policy / Permissions Policy
        res.setHeader(
            "Permissions-Policy",
            "geolocation=(), microphone=(), camera=(), payment=()"
        );

        next();
    });
};

// Parse and validate CORS origins once at startup.
// Set CORS_ALLOWED_ORIGINS as a comma-separated list in your .env:
//   CORS_ALLOWED_ORIGINS=https://app.pearlme.com,https://admin.pearlme.com
// Falls back to FRONTEND_URL, then localhost for development.
const rawOrigins =
    process.env.CORS_ALLOWED_ORIGINS ||
    process.env.FRONTEND_URL ||
    "http://localhost:3000";

const allowedOrigins: string[] = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

// Validate each origin at startup — throws if any entry is malformed,
// preventing silent CORS misconfigurations in production.
for (const origin of allowedOrigins) {
    try {
        new URL(origin);
    } catch {
        throw new Error(`Invalid CORS origin in config: "${origin}"`);
    }
}

export const corsOptions = {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    maxAge: 600,
};
