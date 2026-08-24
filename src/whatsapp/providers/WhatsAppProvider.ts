export type WhatsAppStatus =
	| "disconnected"
	| "connecting"
	| "qr_required"
	| "connected"
	| "logged_out";

export type WhatsAppStatusInfo = {
	status: WhatsAppStatus;
	phone?: string;
};

export type SendMessageResult =
	| { success: true; messageId: string }
	| { success: false; error: string };

/**
 * Contract every WhatsApp integration must follow (PRD §5.2). The rest of
 * the application depends on this interface, never on a concrete provider.
 */
export interface WhatsAppProvider {
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	getStatus(): Promise<WhatsAppStatusInfo>;
	getQrCode(): Promise<string | null>;
	sendMessage(phone: string, message: string): Promise<SendMessageResult>;
}
