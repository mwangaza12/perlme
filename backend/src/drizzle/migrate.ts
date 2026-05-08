import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../utils/logger";
import db, { pool } from "./db";

async function migration() {
    logger.info("-----Migration Started SuccessFully!------");
    await migrate(db, { migrationsFolder: __dirname + "/migrations" });
    await pool.end();
    logger.info("-----Migration ended SuccessFully!-------");
    process.exit(0);
}

migration().catch((err) => {
    logger.error({ error: err }, "Migration failed");
    process.exit(1);
})
