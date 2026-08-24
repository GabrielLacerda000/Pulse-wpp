import { describe, expect, it } from "bun:test";
import { createLogger } from "../../logger";
import type {
	SendMessageResult,
	WhatsAppProvider,
	WhatsAppStatus,
	WhatsAppStatusInfo,
} from "../providers/WhatsAppProvider";
import { WhatsAppConnectionService } from "./WhatsAppConnectionService";

class StubProvider implements WhatsAppProvider {
	status: WhatsAppStatus = "disconnected";
	qrCode: string | null = null;
	connectCalls = 0;
	disconnectCalls = 0;

	async connect(): Promise<void> {
		this.connectCalls++;
	}

	async disconnect(): Promise<void> {
		this.disconnectCalls++;
	}

	async getStatus(): Promise<WhatsAppStatusInfo> {
		return { status: this.status };
	}

	async getQrCode(): Promise<string | null> {
		return this.qrCode;
	}

	async sendMessage(): Promise<SendMessageResult> {
		return { success: true, messageId: "stub-message-id" };
	}
}

function silentLogger() {
	return createLogger({ write: () => {} });
}

describe("WhatsAppConnectionService", () => {
	it("delegates connect() to the provider and returns its status", async () => {
		const provider = new StubProvider();
		provider.status = "qr_required";
		const service = new WhatsAppConnectionService(provider, silentLogger());

		const status = await service.connect();

		expect(provider.connectCalls).toBe(1);
		expect(status).toEqual({ status: "qr_required" });
	});

	it("delegates disconnect() to the provider and returns its status", async () => {
		const provider = new StubProvider();
		const service = new WhatsAppConnectionService(provider, silentLogger());

		const status = await service.disconnect();

		expect(provider.disconnectCalls).toBe(1);
		expect(status).toEqual({ status: "disconnected" });
	});

	it("delegates getStatus() and getQrCode() straight through", async () => {
		const provider = new StubProvider();
		provider.status = "connected";
		provider.qrCode = "some-qr";
		const service = new WhatsAppConnectionService(provider, silentLogger());

		expect(await service.getStatus()).toEqual({ status: "connected" });
		expect(await service.getQrCode()).toBe("some-qr");
	});
});
