import { describe, expect, it } from "bun:test";
import { FakeProvider } from "./FakeProvider";

describe("FakeProvider", () => {
	it("starts disconnected with no pending QR", async () => {
		const provider = new FakeProvider();

		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
		expect(await provider.getQrCode()).toBeNull();
	});

	it("moves to qr_required with a QR code on connect", async () => {
		const provider = new FakeProvider();

		await provider.connect();

		expect(await provider.getStatus()).toEqual({ status: "qr_required" });
		expect(await provider.getQrCode()).not.toBeNull();
	});

	it("passes through connecting before reaching qr_required", async () => {
		const provider = new FakeProvider();

		const connecting = provider.connect();
		expect(await provider.getStatus()).toEqual({ status: "connecting" });

		await connecting;
		expect(await provider.getStatus()).toEqual({ status: "qr_required" });
	});

	it("moves to connected with a phone once the QR is scanned", async () => {
		const provider = new FakeProvider();
		await provider.connect();

		provider.simulateQrScanned();

		expect(await provider.getStatus()).toEqual({
			status: "connected",
			phone: "5582999999999",
		});
		expect(await provider.getQrCode()).toBeNull();
	});

	it("ignores a simulated scan when no QR is pending", async () => {
		const provider = new FakeProvider();

		provider.simulateQrScanned();

		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
	});

	it("returns to disconnected on disconnect", async () => {
		const provider = new FakeProvider();
		await provider.connect();
		provider.simulateQrScanned();

		await provider.disconnect();

		expect(await provider.getStatus()).toEqual({ status: "disconnected" });
		expect(await provider.getQrCode()).toBeNull();
	});

	it("fails to send a message when not connected", async () => {
		const provider = new FakeProvider();

		const result = await provider.sendMessage("5582999999999", "hi");

		expect(result).toEqual({
			success: false,
			error: "WhatsApp is not connected.",
		});
	});

	it("sends a message once connected", async () => {
		const provider = new FakeProvider();
		await provider.connect();
		provider.simulateQrScanned();

		const result = await provider.sendMessage("5582999999999", "hi");

		expect(result.success).toBe(true);
	});
});
