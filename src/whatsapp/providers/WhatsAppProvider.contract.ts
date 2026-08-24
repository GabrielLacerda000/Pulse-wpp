import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { WhatsAppProvider } from "./WhatsAppProvider";

/**
 * Wiring a provider needs to reach qr_required/connected differs per
 * implementation (FakeProvider does it synchronously, BaileysProvider needs
 * connection.update events). The harness hides that behind two hooks so the
 * assertions below stay identical for every provider (PRD §34 Regra 4).
 */
export type WhatsAppProviderHarness = {
	provider: WhatsAppProvider;
	reachQrRequired(): Promise<void>;
	reachConnected(): Promise<void>;
	teardown?(): Promise<void>;
};

const PHONE = "5582999999999";

/**
 * Contract every `WhatsAppProvider` implementation must satisfy. Instantiate
 * once per provider by passing a harness factory — no new test logic should
 * be needed to validate a future provider (issue #6).
 */
export function runWhatsAppProviderContract(
	providerName: string,
	createHarness: () =>
		| WhatsAppProviderHarness
		| Promise<WhatsAppProviderHarness>,
): void {
	describe(`${providerName} (WhatsAppProvider contract)`, () => {
		let harness: WhatsAppProviderHarness;

		beforeEach(async () => {
			harness = await createHarness();
		});

		afterEach(async () => {
			await harness.teardown?.();
		});

		it("starts disconnected with no pending QR", async () => {
			expect(await harness.provider.getStatus()).toEqual({
				status: "disconnected",
			});
			expect(await harness.provider.getQrCode()).toBeNull();
		});

		it("returns null from getQrCode when no QR is pending", async () => {
			expect(await harness.provider.getQrCode()).toBeNull();
		});

		it("moves to qr_required with a QR code once a connection is requested", async () => {
			await harness.reachQrRequired();

			expect(await harness.provider.getStatus()).toEqual({
				status: "qr_required",
			});
			expect(await harness.provider.getQrCode()).not.toBeNull();
		});

		it("moves to connected once the QR is scanned", async () => {
			await harness.reachConnected();

			const status = await harness.provider.getStatus();
			expect(status.status).toBe("connected");
			expect(await harness.provider.getQrCode()).toBeNull();
		});

		it("returns to disconnected on disconnect", async () => {
			await harness.reachConnected();

			await harness.provider.disconnect();

			expect(await harness.provider.getStatus()).toEqual({
				status: "disconnected",
			});
			expect(await harness.provider.getQrCode()).toBeNull();
		});

		it("fails to send a message while disconnected", async () => {
			const result = await harness.provider.sendMessage(PHONE, "hi");

			expect(result).toEqual({
				success: false,
				error: "WhatsApp is not connected.",
			});
		});

		it("sends a message once connected", async () => {
			await harness.reachConnected();

			const result = await harness.provider.sendMessage(PHONE, "hi");

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.messageId.length).toBeGreaterThan(0);
			}
		});
	});
}
