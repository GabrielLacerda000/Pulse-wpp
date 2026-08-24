import type { Logger } from "pino";
import type {
	WhatsAppProvider,
	WhatsAppStatusInfo,
} from "../providers/WhatsAppProvider";

/**
 * Use case: manage the WhatsApp connection lifecycle (PRD §5.2, RF02-RF05).
 */
export class WhatsAppConnectionService {
	constructor(
		private readonly provider: WhatsAppProvider,
		private readonly logger: Logger,
	) {}

	async connect(): Promise<WhatsAppStatusInfo> {
		this.logger.info({ event: "WHATSAPP_CONNECTING" });
		await this.provider.connect();

		const status = await this.provider.getStatus();
		if (status.status === "qr_required") {
			this.logger.info({ event: "QR_GENERATED" });
		} else if (status.status === "connected") {
			// A provider with a persisted session (e.g. Baileys reconnecting)
			// can go straight to "connected" without a QR step.
			this.logger.info({ event: "WHATSAPP_CONNECTED" });
		}

		return status;
	}

	async disconnect(): Promise<WhatsAppStatusInfo> {
		await this.provider.disconnect();
		this.logger.info({ event: "WHATSAPP_DISCONNECTED" });
		return this.provider.getStatus();
	}

	getStatus(): Promise<WhatsAppStatusInfo> {
		return this.provider.getStatus();
	}

	getQrCode(): Promise<string | null> {
		return this.provider.getQrCode();
	}
}
