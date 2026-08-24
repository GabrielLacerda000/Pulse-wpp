/**
 * Stable error codes from PRD §20. Reserved here even though only
 * UNAUTHORIZED is produced today, so later tickets share one vocabulary.
 */
export const ERROR_CODES = [
	"UNAUTHORIZED",
	"INVALID_REQUEST",
	"WHATSAPP_NOT_CONNECTED",
	"WHATSAPP_AUTH_REQUIRED",
	"MESSAGE_SEND_FAILED",
	"PROVIDER_UNAVAILABLE",
	"INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorEnvelope = {
	success: false;
	error: {
		code: ErrorCode;
		message: string;
	};
};

export function errorEnvelope(code: ErrorCode, message: string): ErrorEnvelope {
	return { success: false, error: { code, message } };
}
