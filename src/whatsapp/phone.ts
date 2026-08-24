/**
 * Format check only (PRD RF08). Full lead-data normalization stays in
 * Pulse — this just rejects obviously malformed input before a send
 * attempt, e.g. missing country code, letters, or punctuation.
 */
const PHONE_PATTERN = /^\d{10,15}$/;

export function isValidPhoneNumber(phone: string): boolean {
	return PHONE_PATTERN.test(phone);
}
