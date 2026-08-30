async function call(name: string, args: Record<string, any> = {}): Promise<any> {
	const res = await fetch("/api", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ fn: name, args }),
	});

	const data = await res.json();
	if (!data.ok) {
		throw new Error(data.error ?? "Request failed");
	}
	return data.result;
}

export function query(name: string, args: Record<string, any> = {}): Promise<any> {
	return call(name, args);
}

export function mutation(name: string, args: Record<string, any> = {}): Promise<any> {
	return call(name, args);
}
