import { Elysia } from "elysia";
import { loadConfig } from "./config/env";
import { createAuthPlugin } from "./http/auth";
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
	.use(createAuthPlugin(config, logger))
	.use(healthPlugin)
	.use(createWhatsAppPlugin(whatsappConnectionService))
	.use(createMessagesPlugin(whatsappMessageService))
	.listen(config.server.port);

logger.info({
	event: "SERVICE_STARTED",
	port: app.server?.port,
	hostname: app.server?.hostname,
});
