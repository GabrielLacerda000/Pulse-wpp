import { describe, expect, it } from "bun:test";
import { ConfigValidationError, loadConfig } from "./env";

function validEnv(
	overrides: Partial<NodeJS.ProcessEnv> = {},
): NodeJS.ProcessEnv {
	return {
		APP_PORT: "3000",
		APP_HOST: "0.0.0.0",
		WHATSAPP_PROVIDER: "baileys",
		WHATSAPP_SESSION_PATH: "./sessions",
		PULSE_WPP_API_KEY: "test-api-key",
		LOG_LEVEL: "info",
		...overrides,
	} as NodeJS.ProcessEnv;
}

describe("loadConfig", () => {
	it("loads a valid config", () => {
		const config = loadConfig(validEnv());

		expect(config).toEqual({
			server: { port: 3000, host: "0.0.0.0" },
			whatsapp: { provider: "baileys", sessionPath: "./sessions" },
			auth: { apiKey: "test-api-key" },
			log: { level: "info" },
		});
	});

	it("accepts PULSE_API_KEY as an alias for PULSE_WPP_API_KEY", () => {
		const env = validEnv({
			PULSE_WPP_API_KEY: undefined,
			PULSE_API_KEY: "alias-key",
		});
		const config = loadConfig(env);

		expect(config.auth.apiKey).toBe("alias-key");
	});

	it("prefers PULSE_WPP_API_KEY over the alias when both are set", () => {
		const env = validEnv({
			PULSE_WPP_API_KEY: "canonical-key",
			PULSE_API_KEY: "alias-key",
		});
		const config = loadConfig(env);

		expect(config.auth.apiKey).toBe("canonical-key");
	});

	it("throws with a clear message when required vars are missing", () => {
		expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow(
			ConfigValidationError,
		);
	});

	it("lists every missing/invalid var in the error message", () => {
		try {
			loadConfig({} as NodeJS.ProcessEnv);
			throw new Error("expected loadConfig to throw");
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigValidationError);
			const message = (error as Error).message;
			expect(message).toContain("APP_PORT");
			expect(message).toContain("APP_HOST");
			expect(message).toContain("WHATSAPP_PROVIDER");
			expect(message).toContain("WHATSAPP_SESSION_PATH");
			expect(message).toContain("PULSE_WPP_API_KEY");
			expect(message).toContain("LOG_LEVEL");
		}
	});

	it("rejects an invalid APP_PORT", () => {
		const env = validEnv({ APP_PORT: "not-a-number" });
		expect(() => loadConfig(env)).toThrow(ConfigValidationError);
	});

	it("rejects a port out of range", () => {
		const env = validEnv({ APP_PORT: "70000" });
		expect(() => loadConfig(env)).toThrow(ConfigValidationError);
	});

	it("rejects an invalid LOG_LEVEL", () => {
		const env = validEnv({ LOG_LEVEL: "verbose" });
		expect(() => loadConfig(env)).toThrow(ConfigValidationError);
	});
});
