import { Resend } from "resend";
import { RESEND_API_KEY, RESEND_FROM } from "$env/static/private";

const API_KEY = RESEND_API_KEY;
const FROM = RESEND_FROM;

async function send(email: string, subject: string, text: string): Promise<void> {
	if (!API_KEY) {
		throw new Error("Server error: API key is not configured");
	}

	if (!FROM) {
		throw new Error("Server error: From address is not configured");
	}

	const resend = new Resend(API_KEY);
	const { error } = await resend.emails.send({
		from: FROM,
		to: email,
		subject,
		text,
	});

	if (error) {
		throw new Error(error.message);
	}
}

export function sendVerificationCode(email: string, code: string): Promise<void> {
	return send(
		email,
		"Your DSEC Notebook verification code",
		`Your verification code is ${code}. It expires in 10 minutes.`,
	);
}

export function sendPasswordResetCode(email: string, code: string): Promise<void> {
	return send(
		email,
		"Your DSEC Notebook password reset code",
		`Your password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
	);
}
