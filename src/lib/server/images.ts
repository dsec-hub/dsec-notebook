import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve, join, extname, basename } from "node:path";
import { env } from "$env/dynamic/private";

const DATA_DIR = dirname(resolve(env.DATABASE_PATH ?? "data/dsec.db"));
const UPLOAD_DIR = join(DATA_DIR, "uploads");

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
};

function extForMime(mime: string): string | null {
	switch (mime.toLowerCase()) {
		case "image/png":
			return ".png";
		case "image/jpeg":
			return ".jpg";
		case "image/gif":
			return ".gif";
		case "image/webp":
			return ".webp";
		default:
			return null;
	}
}

export interface StoredImage {
	filename: string;
	mime: string;
	buffer: Uint8Array<ArrayBuffer>;
}

export function saveImage(buffer: Buffer, mime: string): string {
	const ext = extForMime(mime);
	if (!ext) throw new Error("Only PNG, JPG, GIF and WebP images are supported");
	if (buffer.length === 0) throw new Error("Image is empty");
	if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image is too large (max 10MB)");

	mkdirSync(UPLOAD_DIR, { recursive: true });
	const filename = `${randomUUID()}${ext}`;
	writeFileSync(join(UPLOAD_DIR, filename), buffer);
	return filename;
}

export function getImage(filename: string): StoredImage | null {
	const name = basename(filename);
	const ext = extname(name).toLowerCase();
	const mime = MIME_BY_EXT[ext];
	if (!mime) return null;

	const path = join(UPLOAD_DIR, name);
	if (!existsSync(path)) return null;

	const data = readFileSync(path);
	const buffer = new Uint8Array(data.byteLength);
	buffer.set(data);
	return { filename: name, mime, buffer };
}
