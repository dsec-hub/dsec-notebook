export function unitPath(code: string): string {
	return `/${encodeURIComponent(code)}`;
}

export function postPath(code: string, postId: string): string {
	return `${unitPath(code)}/${encodeURIComponent(postId)}`;
}

const SKIP_APP_PREFIXES = ["/uploads/", "/api/"];

const APP_SECTIONS = new Set([
	"notes",
	"questions",
	"units",
	"users",
	"topics",
	"search",
	"account",
	"admin",
	"auth",
	"post",
]);

export function toAppPath(href: string, origin?: string): string | null {
	const trimmed = href.trim();
	if (!trimmed || trimmed.startsWith("#") || /^(?:mailto|javascript|data|blob):/i.test(trimmed)) {
		return null;
	}

	let url: URL;
	try {
		if (origin) {
			url = new URL(trimmed, origin);
			if (url.origin !== new URL(origin).origin) return null;
		} else if (trimmed.startsWith("/")) {
			url = new URL(trimmed, "https://internal.invalid");
		} else {
			return null;
		}
	} catch {
		return null;
	}

	if (SKIP_APP_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return null;

	return `${url.pathname}${url.search}${url.hash}`;
}

export function postIdFromAppPath(appPath: string): string | null {
	const url = new URL(appPath, "https://internal.invalid");
	const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	if (parts.length !== 2) return null;

	const [head, rest] = parts;
	if (!rest) return null;
	if (head === "notes" || head === "questions") return rest;
	if (APP_SECTIONS.has(head)) return null;
	return rest;
}

export function appPathLabel(appPath: string, titles?: Record<string, string>): string {
	const postId = postIdFromAppPath(appPath);
	const title = postId ? titles?.[postId]?.trim() : undefined;
	if (title) return title;

	const url = new URL(appPath, "https://internal.invalid");
	const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
	if (parts.length === 0) return "Home";

	const [head, rest] = parts;
	switch (head) {
		case "notes":
			return rest ? "Note" : "Notes";
		case "questions":
			return rest ? "Question" : "Questions";
		case "units":
			return rest ? rest.toUpperCase() : "Units";
		case "users":
			return "Profile";
		case "topics":
			return rest ?? "Topics";
		case "search":
			return "Search";
		case "account":
			return "Account";
		case "admin":
			return "Admin";
		case "auth":
			return "Sign in";
		case "post":
			return rest === "question" ? "New question" : "New note";
		default:
			return rest ? `${head} post` : head;
	}
}

export function isAutolinkText(text: string, href: string, appPath: string): boolean {
	const value = text.trim();
	if (!value) return false;
	const candidates = [href, appPath];
	try {
		candidates.push(decodeURI(href), decodeURI(appPath));
	} catch {
		/* ignore malformed percent-encoding */
	}
	return candidates.some(
		(candidate) => candidate === value || candidate.replace(/\/$/, "") === value,
	);
}
