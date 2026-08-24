import { Elysia } from "elysia";
import type { Logger } from "pino";
import type { WhatsAppStatusInfo } from "../whatsapp/providers/WhatsAppProvider";
import type { WhatsAppConnectionService } from "../whatsapp/services/WhatsAppConnectionService";
import { type ErrorEnvelope, errorEnvelope } from "./errors";

/**
 * connect()/disconnect() are the only calls here that reach the Baileys
 * socket directly, so they're the only ones that can fail with an
 * unpredictable provider error (RNF08) — status/getQrCode just read local
 * state and cannot throw under the WhatsAppProvider contract.
 */
async function withProviderErrorHandling(
	logger: Logger,
	set: { status?: number },
	operation: () => Promise<WhatsAppStatusInfo>,
): Promise<WhatsAppStatusInfo | ErrorEnvelope> {
	try {
		return await operation();
	} catch (error) {
		logger.error({ event: "PROVIDER_ERROR", error });
		set.status = 503;
		return errorEnvelope(
			"PROVIDER_UNAVAILABLE",
			"WhatsApp provider is unavailable.",
		);
	}
}

export function createWhatsAppPlugin(
	service: WhatsAppConnectionService,
	logger: Logger,
) {
	return new Elysia({ name: "whatsapp" })
		.get("/whatsapp/status", () => service.getStatus())
		.get("/whatsapp/qr", async () => ({ qr: await service.getQrCode() }))
		.post("/whatsapp/connect", ({ set }) =>
			withProviderErrorHandling(logger, set, () => service.connect()),
		)
		.post("/whatsapp/disconnect", ({ set }) =>
			withProviderErrorHandling(logger, set, () => service.disconnect()),
		);
}
