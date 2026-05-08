import { logger } from "../../utils/logger";
import { EmailServiceFactory } from './EmailServiceFactory';
import { EmailParams } from './EmailService.interface';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const sendEmail = async (params: EmailParams): Promise<boolean> => {
    const provider = EmailServiceFactory.getProvider();

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const result = await provider.sendEmail(params);

        if (result.success) return true;

        logger.warn(
            { attempt, maxRetries: MAX_RETRIES, to: params.to, error: result.error },
            "Email send failed, retrying..."
        );

        if (attempt < MAX_RETRIES) {
            await sleep(BASE_DELAY_MS * 2 ** (attempt - 1)); // 1s, 2s, 4s
        }
    }

    logger.error({ to: params.to }, "Email send failed after all retries");
    return false;
};

export const sendNotificationEmailV2 = async (
    to: string,
    subject: string,
    html: string,
    from?: string
): Promise<boolean> => {
    return sendEmail({ to, subject, html, from });
};
