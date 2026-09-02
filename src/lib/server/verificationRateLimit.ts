import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export const VERIFICATION_REQUEST_LIMIT = 5;
export const VERIFICATION_BAN_MS = 24 * 60 * 60 * 1000;

type LimitRow = {
	requestCount: number;
	windowStartedAt: number;
	blockedUntil: number;
};

export class VerificationRateLimitError extends Error {
	constructor(public readonly blockedUntil: number) {
		super("Too many verification requests. Try again in 24 hours.");
		this.name = "VerificationRateLimitError";
	}
}

function identifier(type: "ip" | "client", value: string): string {
	return createHash("sha256").update(`${type}:${value}`).digest("hex");
}

/**
 * Records a verification-email request for both the IP and browser. The fifth
 * request starts a one-day block and is rejected.
 */
export function recordVerificationRequest(
	db: DatabaseSync,
	ip: string,
	clientId: string,
	now = Date.now(),
): void {
	const identifiers = [identifier("ip", ip), identifier("client", clientId)];
	const select = db.prepare(
		"SELECT requestCount, windowStartedAt, blockedUntil FROM verification_request_limits WHERE identifier = ?",
	);
	const upsert = db.prepare(`
		INSERT INTO verification_request_limits
			(identifier, requestCount, windowStartedAt, blockedUntil)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(identifier) DO UPDATE SET
			requestCount = excluded.requestCount,
			windowStartedAt = excluded.windowStartedAt,
			blockedUntil = excluded.blockedUntil
	`);

	db.exec("BEGIN IMMEDIATE");
	try {
		const rows = identifiers.map((key) => select.get(key) as LimitRow | undefined);
		const activeBlock = Math.max(
			0,
			...rows.map((row) => (row && row.blockedUntil > now ? row.blockedUntil : 0)),
		);

		if (activeBlock > now) {
			for (let index = 0; index < identifiers.length; index++) {
				const row = rows[index];
				upsert.run(
					identifiers[index],
					Math.max(row?.requestCount ?? 0, VERIFICATION_REQUEST_LIMIT),
					row?.windowStartedAt ?? now,
					activeBlock,
				);
			}
			db.exec("COMMIT");
			throw new VerificationRateLimitError(activeBlock);
		}

		const counts = rows.map((row) =>
			row && now - row.windowStartedAt < VERIFICATION_BAN_MS ? row.requestCount + 1 : 1,
		);
		const shouldBlock = counts.some((count) => count >= VERIFICATION_REQUEST_LIMIT);
		const blockedUntil = shouldBlock ? now + VERIFICATION_BAN_MS : 0;

		for (let index = 0; index < identifiers.length; index++) {
			const row = rows[index];
			const windowStartedAt =
				row && now - row.windowStartedAt < VERIFICATION_BAN_MS ? row.windowStartedAt : now;
			upsert.run(identifiers[index], counts[index], windowStartedAt, blockedUntil);
		}
		db.exec("COMMIT");

		if (shouldBlock) {
			throw new VerificationRateLimitError(blockedUntil);
		}
	} catch (error) {
		if (!(error instanceof VerificationRateLimitError)) {
			db.exec("ROLLBACK");
		}
		throw error;
	}
}
