import { mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLogger } from "../../logger";
import { runWhatsAppProviderContract } from "./WhatsAppProvider.contract";

type ConnectionUpdate = {
	qr?: string;
	connection?: "open" | "connecting" | "close";
	lastDisconnect?: { error: unknown };
};

type FakeSocket = {
	ev: { on: (event: string, handler: (payload: unknown) => void) => void };
	user: { id: string } | undefined;
	sendMessage: (
		jid: string,
		content: { text: string },
	) => Promise<{ key: { id: string } } | undefined>;
	end: (error: Error | undefined) => void;
};

let fakeSocket: FakeSocket;
let handlers: Record<string, (payload: unknown) => void>;

function emitConnectionUpdate(update: ConnectionUpdate) {
	handlers["connection.update"]?.(update);
}

mock.module("@whiskeysockets/baileys", () => ({
	__esModule: true,
	default: () => fakeSocket,
	DisconnectReason: { loggedOut: 401 },
	fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 0] }),
	useMultiFileAuthState: async () => ({
		state: { creds: {}, keys: {} },
		saveCreds: async () => {},
	}),
}));

const { BaileysProvider } = await import("./BaileysProvider");

function silentLogger() {
	return createLogger({ write: () => {} });
}

runWhatsAppProviderContract("BaileysProvider", async () => {
	const sessionPath = await mkdtemp(join(tmpdir(), "pulse-wpp-contract-"));
	handlers = {};
	fakeSocket = {
		ev: {
			on: (event, handler) => {
				handlers[event] = handler;
			},
		},
		user: undefined,
		sendMessage: async () => ({ key: { id: "wa-contract-message" } }),
		end: () => {},
	};

	const provider = new BaileysProvider(sessionPath, silentLogger());

	return {
		provider,
		reachQrRequired: async () => {
			await provider.connect();
			emitConnectionUpdate({ qr: "contract-qr-data" });
		},
		reachConnected: async () => {
			await provider.connect();
			fakeSocket.user = { id: "5582999999999@s.whatsapp.net" };
			emitConnectionUpdate({ connection: "open" });
		},
		teardown: async () => {
			await rm(sessionPath, { recursive: true, force: true });
		},
	};
});
