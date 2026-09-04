import type { UnitDoc } from "$lib/types";

export function unitMatchesQuery(
	unit: Pick<UnitDoc, "code" | "code2" | "name" | "description">,
	query: string,
): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return [unit.code, unit.code2, unit.name, unit.description].some((value) =>
		value?.toLowerCase().includes(q),
	);
}
