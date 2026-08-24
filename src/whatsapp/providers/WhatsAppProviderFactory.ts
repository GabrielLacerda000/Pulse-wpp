import type { Logger } from "pino";
import { BaileysProvider } from "./BaileysProvider";
import { FakeProvider } from "./FakeProvider";
import type { WhatsAppProvider } from "./WhatsAppProvider";

/**
 * Provider names this factory can build today. "baileys-stub" is a
 * placeholder that behaves like "baileys" from the outside without a real
 * WhatsApp connection.
 */
const KNOWN_PROVIDERS = new Set(["fake", "baileys-stub", "baileys"]);

export class UnsupportedProviderError extends Error {
	constructor(provider: string) {
		super(`Unsupported WHATSAPP_PROVIDER: "${provider}"`);
		this.name = "UnsupportedProviderError";
	}
}

/**
 * Centralizes provider creation (PRD §5.3) so the choice of implementation
 * is a config value, not a set of conditionals scattered through the app.
 */
export class WhatsAppProviderFactory {
	static create(
		provider: string,
		sessionPath: string,
		logger: Logger,
	): WhatsAppProvider {
		if (!KNOWN_PROVIDERS.has(provider)) {
			throw new UnsupportedProviderError(provider);
		}

		logger.info({ event: "PROVIDER_INITIALIZED", provider });

		if (provider === "baileys") {
			return new BaileysProvider(sessionPath, logger);
		}
		return new FakeProvider();
	}
}
