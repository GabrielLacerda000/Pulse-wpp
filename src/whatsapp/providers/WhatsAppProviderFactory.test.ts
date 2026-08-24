import { describe, expect, it } from "bun:test";
import { createLogger } from "../../logger";
import { FakeProvider } from "./FakeProvider";
import {
	UnsupportedProviderError,
	WhatsAppProviderFactory,
} from "./WhatsAppProviderFactory";

function silentLogger() {
	return createLogger({ write: () => {} });
}

describe("WhatsAppProviderFactory", () => {
	it("returns a FakeProvider for 'fake'", () => {
		const provider = WhatsAppProviderFactory.create("fake", silentLogger());

		expect(provider).toBeInstanceOf(FakeProvider);
	});

	it("returns a FakeProvider for 'baileys-stub'", () => {
		const provider = WhatsAppProviderFactory.create(
			"baileys-stub",
			silentLogger(),
		);

		expect(provider).toBeInstanceOf(FakeProvider);
	});

	it("throws for an unknown provider name", () => {
		expect(() =>
			WhatsAppProviderFactory.create("meta", silentLogger()),
		).toThrow(UnsupportedProviderError);
	});
});
