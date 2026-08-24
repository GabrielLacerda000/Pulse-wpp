import { Elysia } from "elysia";
import { loadConfig } from "./config/env";
import { createAuthPlugin } from "./http/auth";
import { healthPlugin } from "./http/health";
import { logger } from "./logger";

const config = loadConfig();

const app = new Elysia()
	.use(createAuthPlugin(config, logger))
	.use(healthPlugin)
	.listen(config.server.port);

logger.info({
	event: "SERVICE_STARTED",
	port: app.server?.port,
	hostname: app.server?.hostname,
});
