import swaggerJSDoc from "swagger-jsdoc";

const isProd = process.env.NODE_ENV === "production";

const swaggerSpec = swaggerJSDoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "PerlMe API",
            version: "1.0.0",
            description: "PerlMe Backend API Documentation",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Local",
            },
            ...(process.env.API_BASE_URL
                ? [{ url: process.env.API_BASE_URL, description: "Production" }]
                : []),
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: isProd
        ? [
              "./dist/Auth/**/*.js",
              "./dist/Services/**/*.js",
              "./dist/Middlewares/**/*.js",
          ]
        : [
              "./src/Auth/**/*.ts",
              "./src/Services/**/*.ts",
              "./src/Middlewares/**/*.ts",
          ],
});

export default swaggerSpec;
