import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	VERIFICATION_BAN_MS,
	VerificationRateLimitError,
	recordVerificationRequest,
} from "./verificationRateLimit";

describe("verification request rate limit", () => {
	let db: DatabaseSync;

	beforeEach(() => {
		db = new DatabaseSync(":memory:");
		db.exec(`
			CREATE TABLE verification_request_limits (
				identifier TEXT PRIMARY KEY,
				requestCount INTEGER NOT NULL DEFAULT 0,
				windowStartedAt INTEGER NOT NULL,
				blockedUntil INTEGER NOT NULL DEFAULT 0
			)
		`);
	});

	afterEach(() => {
		db.close();
	});

	it("blocks the IP and browser on the fifth request", () => {
		const now = 1_000;
		for (let attempt = 0; attempt < 4; attempt++) {
			expect(() =>
				recordVerificationRequest(db, "192.0.2.1", "browser-a", now),
			).not.toThrow();
		}

		expect(() => recordVerificationRequest(db, "192.0.2.1", "browser-a", now)).toThrow(
			VerificationRateLimitError,
		);
		expect(() => recordVerificationRequest(db, "192.0.2.1", "browser-b", now)).toThrow(
			VerificationRateLimitError,
		);
		expect(() => recordVerificationRequest(db, "198.51.100.1", "browser-a", now)).toThrow(
			VerificationRateLimitError,
		);
	});

	it("allows requests again after one day", () => {
		const now = 1_000;
		for (let attempt = 0; attempt < 5; attempt++) {
			try {
				recordVerificationRequest(db, "192.0.2.1", "browser-a", now);
			} catch (error) {
				expect(error).toBeInstanceOf(VerificationRateLimitError);
			}
		}

		expect(() =>
			recordVerificationRequest(db, "192.0.2.1", "browser-a", now + VERIFICATION_BAN_MS),
		).not.toThrow();
	});
});
