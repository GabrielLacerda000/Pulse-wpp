import { describe, expect, it } from "bun:test";
import { Elysia, t } from "elysia";
import { createLogger } from "../logger";
import { createErrorHandlerPlugin } from "./errorHandler";

function testApp() {
	const logger = createLogger({ write: () => {} });
	const app = new Elysia()
		.use(createErrorHandlerPlugin(logger))
		.get("/boom", () => {
			throw new Error("boom");
		})
		.post("/typed", () => ({ ok: true }), {
			body: t.Object({ phone: t.String() }),
		});

	return { app };
}

describe("createErrorHandlerPlugin", () => {
	it("leaves an unmatched route as a plain 404, not an internal error", async () => {
		const { app } = testApp();

		const res = await app.handle(
			new Request("http://localhost/does-not-exist"),
		);

		expect(res.status).toBe(404);
	});

	it("maps an unexpected thrown error to INTERNAL_ERROR", async () => {
		const { app } = testApp();

		const res = await app.handle(new Request("http://localhost/boom"));

		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			success: false,
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred.",
			},
		});
	});

	it("maps a body validation failure to INVALID_REQUEST", async () => {
		const { app } = testApp();

		const res = await app.handle(
			new Request("http://localhost/typed", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({}),
			}),
		);

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			success: false,
			error: { code: "INVALID_REQUEST", message: "Invalid request body." },
		});
	});
});
