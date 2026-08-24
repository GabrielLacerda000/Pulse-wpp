import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import type { Config } from "../config/env";
import { createLogger } from "../logger";
import { FakeProvider } from "../whatsapp/providers/FakeProvider";
import type {
	SendMessageResult,
	WhatsAppProvider,
	WhatsAppStatusInfo,
} from "../whatsapp/providers/WhatsAppProvider";
import { WhatsAppConnectionService } from "../whatsapp/services/WhatsAppConnectionService";
import { createAuthPlugin } from "./auth";
import { createWhatsAppPlugin } from "./whatsapp";

class ThrowingProvider implements WhatsAppProvider {
	async connect(): Promise<void> {
		throw new Error("socket setup failed");
	}
	async disconnect(): Promise<void> {
		throw new Error("socket teardown failed");
	}
	async getStatus(): Promise<WhatsAppStatusInfo> {
		return { status: "disconnected" };
	}
	async getQrCode(): Promise<string | null> {
		return null;
	}
	async sendMessage(): Promise<SendMessageResult> {
		return { success: false, error: "unused" };
	}
}

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
	const service = new WhatsAppConnectionService(provider, logger);
	const app = new Elysia()
		.use(createAuthPlugin(testConfig(), logger))
		.use(createWhatsAppPlugin(service, logger));

	return { app, provider };
}

function authedRequest(path: string, init: RequestInit = {}) {
	return new Request(`http://localhost${path}`, {
		...init,
		headers: { ...init.headers, Authorization: `Bearer ${API_KEY}` },
	});
}

describe("whatsapp routes", () => {
	it("requires the API key on every endpoint", async () => {
		const { app } = testApp();

		for (const request of [
			new Request("http://localhost/whatsapp/status"),
			new Request("http://localhost/whatsapp/qr"),
			new Request("http://localhost/whatsapp/connect", { method: "POST" }),
			new Request("http://localhost/whatsapp/disconnect", {
				method: "POST",
			}),
		]) {
			const res = await app.handle(request);
			expect(res.status).toBe(401);
		}
	});

	it("reports disconnected with no QR before connecting", async () => {
		const { app } = testApp();

		const status = await app.handle(authedRequest("/whatsapp/status"));
		expect(await status.json()).toEqual({ status: "disconnected" });

		const qr = await app.handle(authedRequest("/whatsapp/qr"));
		expect(await qr.json()).toEqual({ qr: null });
	});

	it("runs the full connect -> qr_required -> connected -> disconnect cycle", async () => {
		const { app, provider } = testApp();

		const connectRes = await app.handle(
			authedRequest("/whatsapp/connect", { method: "POST" }),
		);
		expect(connectRes.status).toBe(200);
		expect(await connectRes.json()).toEqual({ status: "qr_required" });

		const qrRes = await app.handle(authedRequest("/whatsapp/qr"));
		const { qr } = (await qrRes.json()) as { qr: string | null };
		expect(qr).not.toBeNull();

		provider.simulateQrScanned();

		const statusRes = await app.handle(authedRequest("/whatsapp/status"));
		expect(await statusRes.json()).toEqual({
			status: "connected",
			phone: "5582999999999",
		});

		const disconnectRes = await app.handle(
			authedRequest("/whatsapp/disconnect", { method: "POST" }),
		);
		expect(disconnectRes.status).toBe(200);
		expect(await disconnectRes.json()).toEqual({ status: "disconnected" });

		const finalQr = await app.handle(authedRequest("/whatsapp/qr"));
		expect(await finalQr.json()).toEqual({ qr: null });
	});

	it("returns PROVIDER_UNAVAILABLE when connect fails instead of crashing", async () => {
		const logger = createLogger({ write: () => {} });
		const service = new WhatsAppConnectionService(
			new ThrowingProvider(),
			logger,
		);
		const app = new Elysia()
			.use(createAuthPlugin(testConfig(), logger))
			.use(createWhatsAppPlugin(service, logger));

		const res = await app.handle(
			authedRequest("/whatsapp/connect", { method: "POST" }),
		);

		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			success: false,
			error: {
				code: "PROVIDER_UNAVAILABLE",
				message: "WhatsApp provider is unavailable.",
			},
		});

		const status = await app.handle(authedRequest("/whatsapp/status"));
		expect(status.status).toBe(200);
	});
});
