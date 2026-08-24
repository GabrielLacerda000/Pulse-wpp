import type { Logger } from "pino";
import { FakeProvider } from "./FakeProvider";
import type { WhatsAppProvider } from "./WhatsAppProvider";

/**
 * Provider names this factory can build today. Real "baileys" lands in a
 * follow-up ticket; "baileys-stub" is the placeholder that behaves like it
 * from the outside while the real integration isn't ready.
 */
const KNOWN_PROVIDERS = new Set(["fake", "baileys-stub"]);

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
	static create(provider: string, logger: Logger): WhatsAppProvider {
		if (!KNOWN_PROVIDERS.has(provider)) {
			throw new UnsupportedProviderError(provider);
		}

		logger.info({ event: "PROVIDER_INITIALIZED", provider });
		return new FakeProvider();
	}
}
