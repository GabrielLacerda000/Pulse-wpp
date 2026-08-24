import { describe, expect, it } from "bun:test";
import { Writable } from "node:stream";
import { createLogger } from "./logger";

function captureLogger() {
	const lines: string[] = [];
	const stream = new Writable({
		write(chunk, _encoding, callback) {
			lines.push(chunk.toString());
			callback();
		},
	});
	const logger = createLogger(stream);
	return { logger, lines };
}

function lastLog(lines: string[]): Record<string, unknown> {
	const line = lines.at(-1);
	if (!line) throw new Error("no log line captured");
	return JSON.parse(line);
}

describe("logger", () => {
	it("emits structured JSON with level, event, timestamp and context fields", () => {
		const { logger, lines } = captureLogger();

		logger.info({ event: "WHATSAPP_CONNECTED", phone: "+5511999999999" });

		const entry = lastLog(lines);
		expect(entry.level).toBe("info");
		expect(entry.event).toBe("WHATSAPP_CONNECTED");
		expect(typeof entry.timestamp).toBe("string");
		expect(entry.phone).toBe("+5511999999999");
	});

	it("redacts an API key field instead of leaking it into output", () => {
		const { logger, lines } = captureLogger();

		logger.info({ event: "API_AUTH_FAILED", apiKey: "super-secret-key" });

		const entry = lastLog(lines);
		expect(entry.apiKey).toBe("[REDACTED]");
		expect(JSON.stringify(entry)).not.toContain("super-secret-key");
	});

	it("redacts session credentials nested inside a context object", () => {
		const { logger, lines } = captureLogger();

		logger.info({
			event: "PROVIDER_INITIALIZED",
			session: { credentials: { token: "session-token-value" } },
		});

		const entry = lastLog(lines);
		const session = entry.session as { credentials: unknown };
		expect(session.credentials).toBe("[REDACTED]");
		expect(JSON.stringify(entry)).not.toContain("session-token-value");
	});

	it("redacts full message content", () => {
		const { logger, lines } = captureLogger();

		logger.info({
			event: "MESSAGE_SEND_STARTED",
			message: "hey, here is my credit card 4111 1111 1111 1111",
		});

		const entry = lastLog(lines);
		expect(entry.message).toBe("[REDACTED]");
	});
});
