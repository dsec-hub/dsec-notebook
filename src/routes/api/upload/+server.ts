import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { saveImage } from "$lib/server/images";
import { getUserByToken } from "$lib/server/api";

export const POST: RequestHandler = async ({ request }) => {
	let token: string;
	let file: File | null;

	try {
		const form = await request.formData();
		token = String(form.get("token") ?? "");
		const entry = form.get("file");
		file = entry && typeof (entry as File).arrayBuffer === "function" ? (entry as File) : null;
	} catch {
		return json({ ok: false, error: "Invalid upload" }, { status: 400 });
	}

	if (!getUserByToken(token)) {
		return json({ ok: false, error: "Not authenticated" }, { status: 401 });
	}

	if (!file) {
		return json({ ok: false, error: "No file provided" }, { status: 400 });
	}

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const filename = saveImage(buffer, file.type);
		return json({ ok: true, result: { url: `/uploads/${filename}` } });
	} catch (err: any) {
		return json({ ok: false, error: err?.message ?? "Upload failed" }, { status: 400 });
	}
};
