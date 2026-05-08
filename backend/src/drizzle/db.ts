import "dotenv/config"
import { drizzle } from "drizzle-orm/node-postgres"
import type { Logger as DrizzleLogger } from "drizzle-orm/logger"
import { Pool } from "pg"
import * as schema from "../drizzle/schema"
import { logger } from "../utils/logger"

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL as string,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
})

pool.on("error", (err) => {
    logger.error({ error: err }, "Unexpected PostgreSQL pool error")
})

const drizzleLogger: DrizzleLogger = {
    logQuery: (query, params) => {
        logger.info({ query, params }, "db_query")
    },
}

const db = drizzle(pool, { schema, logger: drizzleLogger })

export default db
