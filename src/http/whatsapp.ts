import { Elysia } from "elysia";
import type { WhatsAppConnectionService } from "../whatsapp/services/WhatsAppConnectionService";

export function createWhatsAppPlugin(service: WhatsAppConnectionService) {
	return new Elysia({ name: "whatsapp" })
		.get("/whatsapp/status", () => service.getStatus())
		.get("/whatsapp/qr", async () => ({ qr: await service.getQrCode() }))
		.post("/whatsapp/connect", () => service.connect())
		.post("/whatsapp/disconnect", () => service.disconnect());
}
