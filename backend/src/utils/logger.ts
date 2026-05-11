import fs from "node:fs";
import path from "node:path";
import pino from "pino";

const logsDir = path.resolve(__dirname, "../../../logs");
const backendLogFile = path.join(logsDir, "backend.log");

if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const destination = pino.destination({
    dest: backendLogFile,
    sync: false,
});

export const pinoLogger = pino(
    {
        level: process.env.LOG_LEVEL || "info",
        base: {
            service: "perlme-backend",
            env: process.env.NODE_ENV || "development",
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    },
    destination
);

// Supports both pino styles:
//   logger.info("msg", value)          → structured: { data: value }
//   logger.info({ key: val }, "msg")   → passed through directly
function makeLogMethod(fn: pino.LogFn) {
    return (msgOrObj: string | object, ...args: unknown[]) => {
        if (typeof msgOrObj === "object") {
            // Pino structured style: (obj, msg?)
            const msg = args[0] as string | undefined;
            if (msg !== undefined) {
                (fn as (obj: object, msg: string) => void).call(pinoLogger, msgOrObj, msg);
            } else {
                (fn as (obj: object) => void).call(pinoLogger, msgOrObj);
            }
        } else {
            // Simple string style: (msg, ...extras)
            if (args.length === 0) {
                fn.call(pinoLogger, msgOrObj);
            } else {
                (fn as (obj: object, msg: string) => void).call(
                    pinoLogger,
                    { data: args.length === 1 ? args[0] : args },
                    msgOrObj
                );
            }
        }
    };
}

export const logger = {
    info: makeLogMethod(pinoLogger.info.bind(pinoLogger)),
    error: makeLogMethod(pinoLogger.error.bind(pinoLogger)),
    warn: makeLogMethod(pinoLogger.warn.bind(pinoLogger)),
    debug: makeLogMethod(pinoLogger.debug.bind(pinoLogger)),
    fatal: makeLogMethod(pinoLogger.fatal.bind(pinoLogger)),
    trace: makeLogMethod(pinoLogger.trace.bind(pinoLogger)),
    flush: () => new Promise<void>(resolve => pinoLogger.flush(() => resolve())),
};

export const logFiles = {
    logsDir,
    backendLogFile,
};
