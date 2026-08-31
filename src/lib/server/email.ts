import { Resend } from "resend";
import { RESEND_API_KEY, RESEND_FROM } from "$env/static/private";

const API_KEY = RESEND_API_KEY;
const FROM = RESEND_FROM;

export async function sendVerificationCode(email: string, code: string): Promise<void> {
	if (!API_KEY) {
		throw new Error("Server error: API error is not configured");
  }

  if (!FROM) {
    throw new Error("Server error: Email is not configured");
  }

	const resend = new Resend(API_KEY);
	const { error } = await resend.emails.send({
		from: FROM,
		to: email,
		subject: "Your DSEC Notebook verification code",
		text: `Your verification code is ${code}. It expires in 10 minutes.`,
	});

	if (error) {
		throw new Error(error.message);
	}
}
