import { Elysia } from "elysia";
import { loadConfig } from "./config/env";
import { logger } from "./logger";

const config = loadConfig();

const app = new Elysia()
	.get("/", () => "Hello Elysia")
	.listen(config.server.port);

logger.info({
	event: "SERVICE_STARTED",
	port: app.server?.port,
	hostname: app.server?.hostname,
});
