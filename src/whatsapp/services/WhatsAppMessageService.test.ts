import { describe, expect, it } from "bun:test";
import { createLogger } from "../../logger";
import {
	InvalidPhoneError,
	MessageSendError,
	WhatsAppNotConnectedError,
} from "../errors";
import { FakeProvider } from "../providers/FakeProvider";
import { WhatsAppMessageService } from "./WhatsAppMessageService";

function testService() {
	const provider = new FakeProvider();
	const logger = createLogger({ write: () => {} });
	const service = new WhatsAppMessageService(provider, logger);
	return { service, provider };
}

describe("WhatsAppMessageService", () => {
	it("sends a message once the provider is connected", async () => {
		const { service, provider } = testService();
		await provider.connect();
		provider.simulateQrScanned();

		const result = await service.send("5582999999999", "Olá!");

		expect(result.messageId).toStartWith("fake-message-");
	});

	it("rejects an invalid phone format before touching the provider", async () => {
		const { service } = testService();

		await expect(service.send("not-a-phone", "Olá!")).rejects.toBeInstanceOf(
			InvalidPhoneError,
		);
	});

	it("reports WHATSAPP_NOT_CONNECTED when the provider is disconnected", async () => {
		const { service } = testService();

		await expect(service.send("5582999999999", "Olá!")).rejects.toBeInstanceOf(
			WhatsAppNotConnectedError,
		);
	});

	it("wraps a provider send failure in MessageSendError", async () => {
		const { service, provider } = testService();
		await provider.connect();
		provider.simulateQrScanned();
		provider.sendMessage = async () => ({
			success: false,
			error: "boom",
		});

		await expect(service.send("5582999999999", "Olá!")).rejects.toBeInstanceOf(
			MessageSendError,
		);
	});
});
