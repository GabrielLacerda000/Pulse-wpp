import { Elysia, t } from "elysia";
import {
	InvalidPhoneError,
	MessageSendError,
	WhatsAppNotConnectedError,
} from "../whatsapp/errors";
import type { WhatsAppMessageService } from "../whatsapp/services/WhatsAppMessageService";
import { errorEnvelope } from "./errors";

export function createMessagesPlugin(service: WhatsAppMessageService) {
	return new Elysia({ name: "messages" }).post(
		"/messages",
		async ({ body, set }) => {
			try {
				const { messageId } = await service.send(body.phone, body.message);
				return { success: true, messageId };
			} catch (error) {
				if (error instanceof InvalidPhoneError) {
					set.status = 400;
					return errorEnvelope("INVALID_REQUEST", error.message);
				}
				if (error instanceof WhatsAppNotConnectedError) {
					set.status = 409;
					return errorEnvelope("WHATSAPP_NOT_CONNECTED", error.message);
				}
				if (error instanceof MessageSendError) {
					set.status = 502;
					return errorEnvelope("MESSAGE_SEND_FAILED", error.message);
				}
				throw error;
			}
		},
		{
			body: t.Object({
				phone: t.String(),
				message: t.String(),
			}),
		},
	);
}
