const LOG_LEVELS = [
	"fatal",
	"error",
	"warn",
	"info",
	"debug",
	"trace",
	"silent",
] as const;

type LogLevel = (typeof LOG_LEVELS)[number];

export type Config = {
	server: {
		port: number;
		host: string;
	};
	whatsapp: {
		provider: string;
		sessionPath: string;
	};
	auth: {
		apiKey: string;
	};
	log: {
		level: LogLevel;
	};
};

export class ConfigValidationError extends Error {
	constructor(problems: string[]) {
		super(
			`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
		);
		this.name = "ConfigValidationError";
	}
}

function requireString(
	env: NodeJS.ProcessEnv,
	key: string,
	problems: string[],
): string {
	const value = env[key];
	if (!value || value.trim() === "") {
		problems.push(`${key} is required`);
		return "";
	}
	return value;
}

function requirePort(
	env: NodeJS.ProcessEnv,
	key: string,
	problems: string[],
): number {
	const raw = env[key];
	if (!raw || raw.trim() === "") {
		problems.push(`${key} is required`);
		return 0;
	}
	const port = Number(raw);
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		problems.push(
			`${key} must be an integer between 1 and 65535, got "${raw}"`,
		);
		return 0;
	}
	return port;
}

function requireLogLevel(
	env: NodeJS.ProcessEnv,
	key: string,
	problems: string[],
): LogLevel {
	const raw = env[key];
	if (!raw || raw.trim() === "") {
		problems.push(`${key} is required`);
		return "info";
	}
	if (!(LOG_LEVELS as readonly string[]).includes(raw)) {
		problems.push(
			`${key} must be one of ${LOG_LEVELS.join(", ")}, got "${raw}"`,
		);
		return "info";
	}
	return raw as LogLevel;
}

/**
 * PULSE_WPP_API_KEY is the canonical name. PULSE_API_KEY is accepted as an
 * alias per PRD §18/§28/§36; when both are set the canonical name wins.
 */
function requireApiKey(env: NodeJS.ProcessEnv, problems: string[]): string {
	const value = env.PULSE_WPP_API_KEY || env.PULSE_API_KEY;
	if (!value || value.trim() === "") {
		problems.push("PULSE_WPP_API_KEY (or its alias PULSE_API_KEY) is required");
		return "";
	}
	return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
	const problems: string[] = [];

	const port = requirePort(env, "APP_PORT", problems);
	const host = requireString(env, "APP_HOST", problems);
	const provider = requireString(env, "WHATSAPP_PROVIDER", problems);
	const sessionPath = requireString(env, "WHATSAPP_SESSION_PATH", problems);
	const apiKey = requireApiKey(env, problems);
	const level = requireLogLevel(env, "LOG_LEVEL", problems);

	if (problems.length > 0) {
		throw new ConfigValidationError(problems);
	}

	return {
		server: { port, host },
		whatsapp: { provider, sessionPath },
		auth: { apiKey },
		log: { level },
	};
}
