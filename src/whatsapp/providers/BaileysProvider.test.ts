import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger } from "../../logger";

type ConnectionUpdate = {
	qr?: string;
	connection?: "open" | "connecting" | "close";
	lastDisconnect?: { error: unknown };
};

let sentMessages: Array<{ jid: string; text: string }> = [];
let fakeSocket: {
	ev: { on: (event: string, handler: (payload: unknown) => void) => void };
	user: { id: string } | undefined;
	sendMessage: (
		jid: string,
		content: { text: string },
	) => Promise<{ key: { id: string } } | undefined>;
	onWhatsApp: (
		...phoneNumber: string[]
	) => Promise<{ jid: string; exists: boolean }[] | undefined>;
	end: (error: Error | undefined) => void;
};
let handlers: Record<string, (payload: unknown) => void>;
let savedCreds: number;
let endCalls: number;
let remainingSocketFailures = 0;
let onWhatsAppExists = true;
let onWhatsAppJidOverride: string | undefined;

function emitConnectionUpdate(update: ConnectionUpdate) {
	handlers["connection.update"]?.(update);
}

mock.module("@whiskeysockets/baileys", () => ({
	__esModule: true,
	default: () => {
		if (remainingSocketFailures > 0) {
			remainingSocketFailures--;
			throw new Error("socket setup failed");
		}
		return fakeSocket;
	},
	DisconnectReason: { loggedOut: 401 },
	fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 0] }),
	useMultiFileAuthState: async () => ({
		state: { creds: {}, keys: {} },
		saveCreds: async () => {
			savedCreds++;
		},
	}),
}));

const { BaileysProvider } = await import("./BaileysProvider");

function silentLogger() {
	return createLogger({ write: () => {} });
}

describe("BaileysProvider", () => {
	let sessionPath: string;

	beforeEach(async () => {
		sessionPath = await mkdtemp(join(tmpdir(), "pulse-wpp-session-"));
		sentMessages = [];
		handlers = {};
		savedCreds = 0;
		endCalls = 0;
		remainingSocketFailures = 0;
		onWhatsAppExists = true;
		onWhatsAppJidOverride = undefined;
		fakeSocket = {
			ev: {
				on: (event, handler) => {
					handlers[event] = handler;
				},
			},
			user: undefined,
			sendMessage: async (jid, content) => {
				sentMessages.push({ jid, text: content.text });
				return { key: { id: "wa-message-1" } };
			},
			onWhatsApp: async (phoneNumber) => [
				{
					jid: onWhatsAppJidOverride ?? `${phoneNumber}@s.whatsapp.net`,
					exists: onWhatsAppExists,
				},
			],
			end: () => {
				endCalls++;
			},
		};
	});

	afterEach(async () => {
		await rm(sessionPath, { recursive: true, force: true });
	});

	it("starts connecting and moves to qr_required when a QR is emitted", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());

		const connecting = provider.connect();
		await connecting;
		emitConnectionUpdate({ qr: "real-qr-data" });

		expect(await provider.getStatus()).toEqual({ status: "qr_required" });
		expect(await provider.getQrCode()).toBe("real-qr-data");
	});

	it("moves to connected with the phone number once the socket opens", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999:12@s.whatsapp.net" };

		emitConnectionUpdate({ connection: "open" });

		expect(await provider.getStatus()).toEqual({
			status: "connected",
			phone: "5582999999999",
		});
		expect(await provider.getQrCode()).toBeNull();
	});

	it("resets to disconnected when setting up the connection fails", async () => {
		await rm(sessionPath, { recursive: true, force: true });
		await writeFile(sessionPath, "not a directory");
		const provider = new BaileysProvider(sessionPath, silentLogger());

		await expect(provider.connect()).rejects.toThrow();

		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
	});

	it("persists credentials via saveCreds on creds.update", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();

		handlers["creds.update"]?.(undefined);
		await new Promise((resolve) => setImmediate(resolve));

		expect(savedCreds).toBe(1);
	});

	it("sends a message once connected", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		const result = await provider.sendMessage("5581988888888", "hello");

		expect(result).toEqual({ success: true, messageId: "wa-message-1" });
		expect(sentMessages).toEqual([
			{ jid: "5581988888888@s.whatsapp.net", text: "hello" },
		]);
	});

	it("sends to the JID onWhatsApp resolves, not one rebuilt from the input phone", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });
		// Brazilian 9th-digit ambiguity: the account WhatsApp resolves for
		// this number is registered under a JID with a different digit count
		// than the phone we were given.
		onWhatsAppJidOverride = "558188888888@s.whatsapp.net";

		const result = await provider.sendMessage("5581988888888", "hello");

		expect(result).toEqual({ success: true, messageId: "wa-message-1" });
		expect(sentMessages).toEqual([
			{ jid: "558188888888@s.whatsapp.net", text: "hello" },
		]);
	});

	it("fails to send a message to a phone number with no WhatsApp account", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });
		onWhatsAppExists = false;

		const result = await provider.sendMessage("5581988888888", "hello");

		expect(result).toEqual({
			success: false,
			error: "Phone number is not registered on WhatsApp.",
		});
		expect(sentMessages).toEqual([]);
	});

	it("fails to send a message when not connected", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());

		const result = await provider.sendMessage("5581988888888", "hello");

		expect(result).toEqual({
			success: false,
			error: "WhatsApp is not connected.",
		});
	});

	it("closes the socket and keeps the session on disconnect", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		await provider.disconnect();

		expect(endCalls).toBe(1);
		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
		expect(await stat(sessionPath)).toBeTruthy();
	});

	it("moves to logged_out and clears the session when the socket reports a logout", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		emitConnectionUpdate({
			connection: "close",
			lastDisconnect: { error: { output: { statusCode: 401 } } },
		});

		expect(await provider.getStatus()).toEqual({ status: "logged_out" });
		await new Promise((resolve) => setTimeout(resolve, 0));
		await expect(stat(sessionPath)).rejects.toThrow();
	});

	it("does not auto-reconnect after a logout, and requires a fresh connect/QR flow", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		emitConnectionUpdate({
			connection: "close",
			lastDisconnect: { error: { output: { statusCode: 401 } } },
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(await provider.getStatus()).toEqual({ status: "logged_out" });

		await provider.connect();
		emitConnectionUpdate({ qr: "fresh-qr-data" });

		expect(await provider.getStatus()).toEqual({ status: "qr_required" });
		expect(await provider.getQrCode()).toBe("fresh-qr-data");
	});

	it("moves to disconnected without clearing the session on a non-logout close", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		emitConnectionUpdate({
			connection: "close",
			lastDisconnect: { error: { output: { statusCode: 428 } } },
		});

		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
		expect(await stat(sessionPath)).toBeTruthy();
	});

	it("automatically reconnects using the persisted session after a transient disconnect", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		emitConnectionUpdate({
			connection: "close",
			lastDisconnect: { error: { output: { statusCode: 428 } } },
		});

		// Let the fire-and-forget reconnect run: it re-enters connect(),
		// which awaits the (mocked) session/version setup before creating a
		// new socket.
		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(await provider.getStatus()).toEqual({ status: "connecting" });
		expect(await provider.getQrCode()).toBeNull();

		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		expect(await provider.getStatus()).toEqual({
			status: "connected",
			phone: "5582999999999",
		});
	});

	it("retries the automatic reconnect after a failed attempt", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger(), 0);
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		remainingSocketFailures = 1;
		emitConnectionUpdate({
			connection: "close",
			lastDisconnect: { error: { output: { statusCode: 428 } } },
		});

		// Yield enough microtasks/timers for: the first (failing) reconnect
		// attempt, the 0ms backoff, and the second (succeeding) attempt.
		for (let i = 0; i < 5; i++) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		expect(await provider.getStatus()).toEqual({ status: "connecting" });
		expect(remainingSocketFailures).toBe(0);

		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		expect(await provider.getStatus()).toEqual({
			status: "connected",
			phone: "5582999999999",
		});
	});

	it("does not auto-reconnect after a manual disconnect", async () => {
		const provider = new BaileysProvider(sessionPath, silentLogger());
		await provider.connect();
		fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
		emitConnectionUpdate({ connection: "open" });

		await provider.disconnect();
		emitConnectionUpdate({
			connection: "close",
			lastDisconnect: { error: { output: { statusCode: 428 } } },
		});

		await new Promise((resolve) => setTimeout(resolve, 0));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
	});
});
