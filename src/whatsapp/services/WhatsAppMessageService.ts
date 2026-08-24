import type { Logger } from "pino";
import {
	InvalidPhoneError,
	MessageSendError,
	WhatsAppAuthRequiredError,
	WhatsAppNotConnectedError,
} from "../errors";
import { isValidPhoneNumber } from "../phone";
import type { WhatsAppProvider } from "../providers/WhatsAppProvider";

export type SendMessageOutcome = {
	messageId: string;
};

/**
 * Use case: send a single message (PRD RF07-RF08).
 */
export class WhatsAppMessageService {
	constructor(
		private readonly provider: WhatsAppProvider,
		private readonly logger: Logger,
	) {}

	async send(phone: string, message: string): Promise<SendMessageOutcome> {
		if (!isValidPhoneNumber(phone)) {
			throw new InvalidPhoneError(phone);
		}

		this.logger.info({ event: "MESSAGE_SEND_STARTED", phone });

		const status = await this.provider.getStatus();
		if (status.status === "logged_out") {
			this.logger.warn({
				event: "MESSAGE_SEND_FAILED",
				phone,
				reason: "auth_required",
			});
			throw new WhatsAppAuthRequiredError();
		}
		if (status.status !== "connected") {
			this.logger.warn({
				event: "MESSAGE_SEND_FAILED",
				phone,
				reason: "not_connected",
			});
			throw new WhatsAppNotConnectedError();
		}

		const result = await this.provider.sendMessage(phone, message);
		if (!result.success) {
			this.logger.error({
				event: "MESSAGE_SEND_FAILED",
				phone,
				error: result.error,
			});
			throw new MessageSendError(result.error);
		}

		this.logger.info({
			event: "MESSAGE_SENT",
			phone,
			messageId: result.messageId,
		});
		return { messageId: result.messageId };
	}
}
