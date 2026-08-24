import pino from "pino";

/**
 * Minimum event taxonomy from PRD §17. Every structured log line that marks
 * a meaningful occurrence should use one of these as its `event` field.
 */
export type LogEvent =
	| "SERVICE_STARTED"
	| "SERVICE_STOPPED"
	| "WHATSAPP_CONNECTING"
	| "WHATSAPP_CONNECTED"
	| "WHATSAPP_DISCONNECTED"
	| "WHATSAPP_LOGGED_OUT"
	| "QR_GENERATED"
	| "MESSAGE_SEND_STARTED"
	| "MESSAGE_SENT"
	| "MESSAGE_SEND_FAILED"
	| "API_REQUEST"
	| "API_AUTH_FAILED"
	| "PROVIDER_INITIALIZED"
	| "PROVIDER_ERROR";

const REDACTED = "[REDACTED]";

/**
 * Field names (at any depth) that must never reach log output: API keys,
 * WhatsApp session credentials/keys, auth tokens and full message content.
 */
const SENSITIVE_FIELDS = [
	"apiKey",
	"api_key",
	"authorization",
	"password",
	"token",
	"accessToken",
	"credentials",
	"creds",
	"sessionCredentials",
	"message",
	"messageContent",
];

const redactPaths = SENSITIVE_FIELDS.flatMap((field) => [
	field,
	`*.${field}`,
	`*.*.${field}`,
	`*.*.*.${field}`,
]);

export function createLogger(
	destination?: pino.DestinationStream,
): pino.Logger {
	return pino(
		{
			level: process.env.LOG_LEVEL ?? "info",
			base: undefined,
			timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
			formatters: {
				level: (label) => ({ level: label }),
			},
			redact: {
				paths: redactPaths,
				censor: REDACTED,
			},
		},
		destination,
	);
}

export const logger = createLogger();
