import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import type { Config } from "../config/env";
import { createLogger } from "../logger";
import { createAuthPlugin } from "./auth";
import { healthPlugin } from "./health";

function testConfig(): Config {
	return {
		server: { port: 3000, host: "0.0.0.0" },
		whatsapp: { provider: "baileys", sessionPath: "./sessions" },
		auth: { apiKey: "secret-key" },
		log: { level: "info" },
	};
}

function testApp() {
	const logger = createLogger({ write: () => {} });
	return new Elysia()
		.use(createAuthPlugin(testConfig(), logger))
		.use(healthPlugin)
		.get("/protected", () => ({ ok: true }));
}

describe("auth middleware", () => {
	it("allows GET /health without auth", async () => {
		const res = await testApp().handle(new Request("http://localhost/health"));

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});

	it("rejects a request with no Authorization header", async () => {
		const res = await testApp().handle(
			new Request("http://localhost/protected"),
		);

		expect(res.status).toBe(401);
		expect(await res.json()).toEqual({
			success: false,
			error: { code: "UNAUTHORIZED", message: "Missing or invalid API key." },
		});
	});

	it("rejects a request with the wrong API key", async () => {
		const res = await testApp().handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: "Bearer wrong-key" },
			}),
		);

		expect(res.status).toBe(401);
	});

	it("allows a request with the correct API key", async () => {
		const res = await testApp().handle(
			new Request("http://localhost/protected", {
				headers: { Authorization: "Bearer secret-key" },
			}),
		);

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});
});
