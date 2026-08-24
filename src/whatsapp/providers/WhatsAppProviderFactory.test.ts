import { describe, expect, it } from "bun:test";
import { createLogger } from "../../logger";
import { BaileysProvider } from "./BaileysProvider";
import { FakeProvider } from "./FakeProvider";
import {
	UnsupportedProviderError,
	WhatsAppProviderFactory,
} from "./WhatsAppProviderFactory";

function create(provider: string) {
	return WhatsAppProviderFactory.create(
		provider,
		"./sessions",
		createLogger({ write: () => {} }),
	);
}

describe("WhatsAppProviderFactory", () => {
	it("returns a FakeProvider for 'fake'", () => {
		expect(create("fake")).toBeInstanceOf(FakeProvider);
	});

	it("returns a FakeProvider for 'baileys-stub'", () => {
		expect(create("baileys-stub")).toBeInstanceOf(FakeProvider);
	});

	it("returns a BaileysProvider for 'baileys'", () => {
		expect(create("baileys")).toBeInstanceOf(BaileysProvider);
	});

	it("throws for an unknown provider name", () => {
		expect(() => create("meta")).toThrow(UnsupportedProviderError);
	});
});
