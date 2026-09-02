import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { call } from "$lib/server/api";
import { getDb } from "$lib/server/db";
import {
	VERIFICATION_BAN_MS,
	VerificationRateLimitError,
	recordVerificationRequest,
} from "$lib/server/verificationRateLimit";

const VERIFICATION_REQUEST_FUNCTIONS = new Set(["auth:requestCode", "admin:requestCode"]);
const VERIFICATION_CLIENT_COOKIE = "dsec_verification_client";

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	let fn: string;
	let args: Record<string, unknown>;

	try {
		const body = await request.json();
		fn = String(body?.fn ?? "");
		args = (body?.args ?? {}) as Record<string, unknown>;
	} catch {
		return json({ ok: false, error: "Invalid request body" }, { status: 400 });
	}

	try {
		if (VERIFICATION_REQUEST_FUNCTIONS.has(fn)) {
			const clientId = cookies.get(VERIFICATION_CLIENT_COOKIE) ?? crypto.randomUUID();
			cookies.set(VERIFICATION_CLIENT_COOKIE, clientId, {
				path: "/",
				httpOnly: true,
				maxAge: VERIFICATION_BAN_MS / 1000,
				sameSite: "lax",
				secure: new URL(request.url).protocol === "https:",
			});
			recordVerificationRequest(getDb(), getClientAddress(), clientId);
		}

		const result = await call(fn, args as Record<string, any>);
		return json({ ok: true, result });
	} catch (err: any) {
		const message = err?.message ?? "Internal error";
		const status =
			err instanceof VerificationRateLimitError
				? 429
				: message === "Not authenticated" || message === "Not authorized"
					? 401
					: 400;
		return json({ ok: false, error: message }, { status });
	}
};
