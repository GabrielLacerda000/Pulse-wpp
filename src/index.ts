import { Elysia } from "elysia";
import { loadConfig } from "./config/env";
import { createAuthPlugin } from "./http/auth";
import { errorEnvelope } from "./http/errors";
import { healthPlugin } from "./http/health";
import { createMessagesPlugin } from "./http/messages";
import { createWhatsAppPlugin } from "./http/whatsapp";
import { logger } from "./logger";
import { WhatsAppProviderFactory } from "./whatsapp/providers/WhatsAppProviderFactory";
import { WhatsAppConnectionService } from "./whatsapp/services/WhatsAppConnectionService";
import { WhatsAppMessageService } from "./whatsapp/services/WhatsAppMessageService";

const config = loadConfig();

const whatsappProvider = WhatsAppProviderFactory.create(
	config.whatsapp.provider,
	config.whatsapp.sessionPath,
	logger,
);
const whatsappConnectionService = new WhatsAppConnectionService(
	whatsappProvider,
	logger,
);
const whatsappMessageService = new WhatsAppMessageService(
	whatsappProvider,
	logger,
);

const app = new Elysia()
	// RNF08: any error that escapes a route (a WhatsApp/provider failure or
	// an Elysia validation error) is turned into a stable envelope instead
	// of taking the HTTP server down.
	.onError(({ code, error, set }) => {
		if (code === "VALIDATION") {
			set.status = 400;
			return errorEnvelope("INVALID_REQUEST", "Invalid request body.");
		}
		logger.error({ event: "PROVIDER_ERROR", error, code });
		set.status = 500;
		return errorEnvelope("INTERNAL_ERROR", "An unexpected error occurred.");
	})
	.use(createAuthPlugin(config, logger))
	.use(healthPlugin)
	.use(createWhatsAppPlugin(whatsappConnectionService, logger))
	.use(createMessagesPlugin(whatsappMessageService))
	.listen(config.server.port);

logger.info({
	event: "SERVICE_STARTED",
	port: app.server?.port,
	hostname: app.server?.hostname,
});

// RNF08: a WhatsApp-side failure (e.g. an error from a Baileys socket event,
// which runs outside any HTTP request) must never crash the process.
process.on("uncaughtException", (error) => {
	logger.error({ event: "PROVIDER_ERROR", error });
});
process.on("unhandledRejection", (error) => {
	logger.error({ event: "PROVIDER_ERROR", error });
});

function shutdown(signal: string): void {
	logger.info({ event: "SERVICE_STOPPED", signal });
	app.stop();
	process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
