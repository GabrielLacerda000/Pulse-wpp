import { Elysia } from "elysia";
import type { Logger } from "pino";
import type { Config } from "../config/env";
import { errorEnvelope } from "./errors";

const BEARER_PREFIX = "Bearer ";

/**
 * Routes that must stay reachable without an API key (PRD RF01).
 */
const PUBLIC_PATHS = new Set(["/health"]);

function extractBearerToken(header: string | null): string | undefined {
	if (!header?.startsWith(BEARER_PREFIX)) {
		return undefined;
	}
	return header.slice(BEARER_PREFIX.length);
}

export function createAuthPlugin(config: Config, logger: Logger) {
	return new Elysia({ name: "auth" }).onRequest(({ request, set }) => {
		const path = new URL(request.url).pathname;

		logger.info({ event: "API_REQUEST", method: request.method, path });

		if (PUBLIC_PATHS.has(path)) {
			return;
		}

		const token = extractBearerToken(request.headers.get("authorization"));

		if (!token || token !== config.auth.apiKey) {
			logger.warn({ event: "API_AUTH_FAILED", method: request.method, path });
			set.status = 401;
			return errorEnvelope("UNAUTHORIZED", "Missing or invalid API key.");
		}
	});
}
