import { mkdir, rm } from "node:fs/promises";
import makeWASocket, {
	type ConnectionState,
	DisconnectReason,
	fetchLatestBaileysVersion,
	useMultiFileAuthState,
	type WASocket,
} from "@whiskeysockets/baileys";
import type { Logger } from "pino";
import type {
	SendMessageResult,
	WhatsAppProvider,
	WhatsAppStatus,
	WhatsAppStatusInfo,
} from "./WhatsAppProvider";

function extractPhoneNumber(jid: string | undefined): string | undefined {
	if (!jid) {
		return undefined;
	}
	return jid.split(/[:@]/)[0];
}

function toJid(phone: string): string {
	return `${phone}@s.whatsapp.net`;
}

function getDisconnectStatusCode(error: unknown): number | undefined {
	if (error && typeof error === "object" && "output" in error) {
		const output = (error as { output?: { statusCode?: unknown } }).output;
		if (output && typeof output.statusCode === "number") {
			return output.statusCode;
		}
	}
	return undefined;
}

/**
 * Real WhatsApp connection via Baileys (PRD RF02-RF06). Baileys-specific
 * types and APIs must stay inside this module (GUIDELINES §5) — every other
 * layer depends only on `WhatsAppProvider`.
 */
export class BaileysProvider implements WhatsAppProvider {
	private status: WhatsAppStatus = "disconnected";
	private qrCode: string | null = null;
	private phone: string | undefined;
	private socket: WASocket | undefined;
	private disconnecting = false;

	constructor(
		private readonly sessionPath: string,
		private readonly logger: Logger,
		private readonly reconnectDelayMs = 2000,
	) {}

	async connect(): Promise<void> {
		if (this.status === "connecting" || this.status === "connected") {
			return;
		}

		this.status = "connecting";
		this.qrCode = null;
		this.disconnecting = false;

		try {
			await mkdir(this.sessionPath, { recursive: true, mode: 0o700 });
			const { state, saveCreds } = await useMultiFileAuthState(
				this.sessionPath,
			);
			const { version } = await fetchLatestBaileysVersion();

			const baileysLogger = this.logger.child({ module: "baileys" });
			baileysLogger.level = "warn";

			const socket = makeWASocket({
				auth: state,
				version,
				logger: baileysLogger,
			});

			this.socket = socket;
			socket.ev.on("creds.update", saveCreds);
			socket.ev.on("connection.update", (update) =>
				this.handleConnectionUpdate(update),
			);
		} catch (error) {
			this.status = "disconnected";
			this.logger.error({ event: "PROVIDER_ERROR", error });
			throw error;
		}
	}

	/**
	 * Closes the local socket but keeps the paired session on disk, so a
	 * later connect() resumes without a QR scan. Only a "logged_out" event
	 * from WhatsApp itself (e.g. unlinked from the phone) clears the
	 * session — that is a distinct, terminal state from a plain disconnect.
	 */
	async disconnect(): Promise<void> {
		this.disconnecting = true;

		this.socket?.end(undefined);

		this.socket = undefined;
		this.status = "disconnected";
		this.qrCode = null;
		this.phone = undefined;
	}

	async getStatus(): Promise<WhatsAppStatusInfo> {
		if (this.status === "connected") {
			return { status: this.status, phone: this.phone };
		}
		return { status: this.status };
	}

	async getQrCode(): Promise<string | null> {
		return this.qrCode;
	}

	async sendMessage(
		phone: string,
		message: string,
	): Promise<SendMessageResult> {
		if (this.status !== "connected" || !this.socket) {
			return { success: false, error: "WhatsApp is not connected." };
		}

		try {
			const sent = await this.socket.sendMessage(toJid(phone), {
				text: message,
			});
			if (!sent?.key.id) {
				return { success: false, error: "Failed to send message." };
			}
			return { success: true, messageId: sent.key.id };
		} catch (error) {
			this.logger.error({ event: "MESSAGE_SEND_FAILED", phone, error });
			return { success: false, error: "Failed to send message." };
		}
	}

	private handleConnectionUpdate(update: Partial<ConnectionState>): void {
		if (update.qr) {
			this.qrCode = update.qr;
			this.status = "qr_required";
			this.logger.info({ event: "QR_GENERATED" });
		}

		if (update.connection === "open") {
			this.qrCode = null;
			this.phone = extractPhoneNumber(this.socket?.user?.id);
			this.status = "connected";
			this.logger.info({ event: "WHATSAPP_CONNECTED" });
		}

		if (update.connection === "close") {
			if (this.disconnecting) {
				return;
			}

			const loggedOut =
				getDisconnectStatusCode(update.lastDisconnect?.error) ===
				DisconnectReason.loggedOut;

			this.socket = undefined;
			this.qrCode = null;
			this.phone = undefined;

			if (loggedOut) {
				this.status = "logged_out";
				this.logger.info({ event: "WHATSAPP_LOGGED_OUT" });
				this.clearSession().catch((clearError) => {
					this.logger.error({ event: "PROVIDER_ERROR", error: clearError });
				});
			} else {
				this.status = "disconnected";
				this.logger.info({ event: "WHATSAPP_DISCONNECTED" });
				// Runs detached from the "close" event handler; errors are
				// handled inside the loop itself (retry or give up while
				// disconnecting), so there is nothing left to reject with.
				void this.reconnectAfterTransientDisconnect();
			}
		}
	}

	/**
	 * PRD §30: a transient disconnect (network blip, socket close) must
	 * resume automatically from the persisted session, with no QR scan,
	 * retrying with a fixed delay until it succeeds or a manual
	 * disconnect() cancels it. The initial `Promise.resolve()` yield keeps
	 * this off the caller's stack so a synchronous status check right after
	 * the "close" event still observes "disconnected" before the reconnect
	 * attempt takes over.
	 */
	private async reconnectAfterTransientDisconnect(): Promise<void> {
		await Promise.resolve();

		while (!this.disconnecting && this.status === "disconnected") {
			this.logger.info({ event: "WHATSAPP_CONNECTING" });
			try {
				await this.connect();
				return;
			} catch {
				// connect() already logged PROVIDER_ERROR for this attempt.
				if (this.disconnecting) {
					return;
				}
				await new Promise((resolve) =>
					setTimeout(resolve, this.reconnectDelayMs),
				);
			}
		}
	}

	private async clearSession(): Promise<void> {
		await rm(this.sessionPath, { recursive: true, force: true });
	}
}
