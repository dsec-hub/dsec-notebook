export function timeAgo(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'JUST NOW';
	if (mins < 60) return `${mins}M AGO`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}H AGO`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}D AGO`;
	const weeks = Math.floor(days / 7);
	if (weeks < 9) return `${weeks}W AGO`;
	return `${Math.floor(days / 365) || 1}Y AGO`;
}
