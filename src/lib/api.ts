async function call(name: string, args: Record<string, any> = {}): Promise<any> {
	const res = await fetch("/api", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ fn: name, args }),
	});

	const data = await res.json().catch(() => null);
	if (!res.ok || !data?.ok) {
		throw new Error(data?.error ?? `Request failed (${res.status})`);
	}
	return data.result;
}

export function query(name: string, args: Record<string, any> = {}): Promise<any> {
	return call(name, args);
}

export function mutation(name: string, args: Record<string, any> = {}): Promise<any> {
	return call(name, args);
}

export async function uploadImage(token: string, file: File): Promise<string> {
	const form = new FormData();
	form.append("token", token);
	form.append("file", file);

	const res = await fetch("/api/upload", { method: "POST", body: form });
	const data = await res.json().catch(() => null);
	if (!res.ok || !data?.ok) {
		throw new Error(data?.error ?? `Upload failed (${res.status})`);
	}
	return data.result.url as string;
}
