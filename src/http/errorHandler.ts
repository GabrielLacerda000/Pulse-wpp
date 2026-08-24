import { Elysia } from "elysia";
import type { Logger } from "pino";
import { errorEnvelope } from "./errors";

/**
 * RNF08: any error that escapes a route (a WhatsApp/provider failure or an
 * Elysia validation error) is turned into a stable envelope instead of
 * taking the HTTP server down. A request to a route that simply doesn't
 * exist is not an application failure — it must stay a plain 404, not get
 * relabeled as PROVIDER_ERROR/INTERNAL_ERROR.
 */
export function createErrorHandlerPlugin(logger: Logger) {
	return (
		new Elysia({ name: "error-handler" })
			.onError(({ code, error, set }) => {
				if (code === "NOT_FOUND") {
					set.status = 404;
					return;
				}
				if (code === "VALIDATION") {
					set.status = 400;
					return errorEnvelope("INVALID_REQUEST", "Invalid request body.");
				}
				logger.error({ event: "PROVIDER_ERROR", error, code });
				set.status = 500;
				return errorEnvelope("INTERNAL_ERROR", "An unexpected error occurred.");
			})
			// Elysia plugin lifecycle hooks are local to the plugin by default;
			// without this, onError above would never fire for routes mounted
			// on the parent app (only for routes defined inside this plugin).
			.as("global")
	);
}
