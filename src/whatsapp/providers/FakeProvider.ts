import type {
	SendMessageResult,
	WhatsAppProvider,
	WhatsAppStatus,
	WhatsAppStatusInfo,
} from "./WhatsAppProvider";

const FAKE_PHONE = "5582999999999";

/**
 * In-memory provider with no network/session dependency (PRD §25, GUIDELINES
 * §17). Used both as the default provider today and as the test double for
 * higher layers. `connect()` mirrors what a real provider does when it needs
 * fresh auth: it goes straight to `qr_required`. Reaching `connected`
 * requires `simulateQrScanned()`, standing in for the scan event a real
 * provider would receive from WhatsApp.
 */
export class FakeProvider implements WhatsAppProvider {
	private status: WhatsAppStatus = "disconnected";
	private qrCode: string | null = null;

	async connect(): Promise<void> {
		this.status = "connecting";
		this.qrCode = null;
		await Promise.resolve();
		this.qrCode = `fake-qr-${Date.now()}`;
		this.status = "qr_required";
	}

	async disconnect(): Promise<void> {
		this.status = "disconnected";
		this.qrCode = null;
	}

	async getStatus(): Promise<WhatsAppStatusInfo> {
		if (this.status === "connected") {
			return { status: this.status, phone: FAKE_PHONE };
		}
		return { status: this.status };
	}

	async getQrCode(): Promise<string | null> {
		return this.qrCode;
	}

	async sendMessage(
		_phone: string,
		_message: string,
	): Promise<SendMessageResult> {
		if (this.status !== "connected") {
			return { success: false, error: "WhatsApp is not connected." };
		}
		return { success: true, messageId: `fake-message-${Date.now()}` };
	}

	simulateQrScanned(): void {
		if (this.status !== "qr_required") {
			return;
		}
		this.status = "connected";
		this.qrCode = null;
	}

	/**
	 * Stands in for a real logout event from WhatsApp (PRD §30) — a terminal
	 * state distinct from a transient disconnect, requiring a fresh QR scan.
	 */
	simulateLogout(): void {
		this.status = "logged_out";
		this.qrCode = null;
	}
}
