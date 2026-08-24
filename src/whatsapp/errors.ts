export class InvalidPhoneError extends Error {
	constructor(phone: string) {
		super(`Invalid phone number format: ${phone}`);
		this.name = "InvalidPhoneError";
	}
}

export class WhatsAppNotConnectedError extends Error {
	constructor() {
		super("WhatsApp is not connected.");
		this.name = "WhatsAppNotConnectedError";
	}
}

export class WhatsAppAuthRequiredError extends Error {
	constructor() {
		super("WhatsApp session was logged out. Reconnect with a new QR code.");
		this.name = "WhatsAppAuthRequiredError";
	}
}

export class MessageSendError extends Error {
	constructor(reason: string) {
		super(reason);
		this.name = "MessageSendError";
	}
}
