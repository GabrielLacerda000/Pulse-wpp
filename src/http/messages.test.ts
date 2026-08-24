import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import type { Config } from "../config/env";
import { createLogger } from "../logger";
import { FakeProvider } from "../whatsapp/providers/FakeProvider";
import { WhatsAppMessageService } from "../whatsapp/services/WhatsAppMessageService";
import { createAuthPlugin } from "./auth";
import { createMessagesPlugin } from "./messages";

const API_KEY = "secret-key";

function testConfig(): Config {
	return {
		server: { port: 3000, host: "0.0.0.0" },
		whatsapp: { provider: "fake", sessionPath: "./sessions" },
		auth: { apiKey: API_KEY },
		log: { level: "info" },
	};
}

function testApp() {
	const logger = createLogger({ write: () => {} });
	const provider = new FakeProvider();
	const service = new WhatsAppMessageService(provider, logger);
	const app = new Elysia()
		.use(createAuthPlugin(testConfig(), logger))
		.use(createMessagesPlugin(service));

	return { app, provider };
}

function authedRequest(path: string, init: RequestInit = {}) {
	return new Request(`http://localhost${path}`, {
		...init,
		headers: {
			...init.headers,
			Authorization: `Bearer ${API_KEY}`,
			"Content-Type": "application/json",
		},
	});
}

async function connectedApp() {
	const { app, provider } = testApp();
	await provider.connect();
	provider.simulateQrScanned();
	return { app, provider };
}

describe("POST /messages", () => {
	it("requires the API key", async () => {
		const { app } = testApp();

		const res = await app.handle(
			new Request("http://localhost/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phone: "5582999999999", message: "hi" }),
			}),
		);

		expect(res.status).toBe(401);
	});

	it("sends the message when connected", async () => {
		const { app } = await connectedApp();

		const res = await app.handle(
			authedRequest("/messages", {
				method: "POST",
				body: JSON.stringify({ phone: "5582999999999", message: "Olá!" }),
			}),
		);

		expect(res.status).toBe(200);
		const json = (await res.json()) as { success: boolean; messageId: string };
		expect(json.success).toBe(true);
		expect(json.messageId).toStartWith("fake-message-");
	});

	it("returns INVALID_REQUEST for a malformed phone", async () => {
		const { app } = await connectedApp();

		const res = await app.handle(
			authedRequest("/messages", {
				method: "POST",
				body: JSON.stringify({ phone: "not-a-phone", message: "Olá!" }),
			}),
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			success: false,
			error: {
				code: "INVALID_REQUEST",
				message: "Invalid phone number format: not-a-phone",
			},
		});
	});

	it("returns WHATSAPP_NOT_CONNECTED when disconnected", async () => {
		const { app } = testApp();

		const res = await app.handle(
			authedRequest("/messages", {
				method: "POST",
				body: JSON.stringify({ phone: "5582999999999", message: "Olá!" }),
			}),
		);

		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({
			success: false,
			error: {
				code: "WHATSAPP_NOT_CONNECTED",
				message: "WhatsApp is not connected.",
			},
		});
	});
});
