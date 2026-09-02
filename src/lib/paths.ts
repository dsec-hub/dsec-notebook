export function unitPath(code: string): string {
	return `/${encodeURIComponent(code)}`;
}

export function postPath(code: string, postId: string): string {
	return `${unitPath(code)}/${encodeURIComponent(postId)}`;
}
