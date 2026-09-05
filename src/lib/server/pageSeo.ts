import { call } from "$lib/server/api";
import { notFoundSeo, postSeo, unitSeo, type PageSeo } from "$lib/seo";

function unitMatchesCode(
	unit: { code?: string; code2?: string } | null | undefined,
	code: string,
): boolean {
	const requested = code.toLowerCase();
	return [unit?.code, unit?.code2].some((value) => value?.toLowerCase() === requested);
}

export async function loadPostSeo(id: string, requestedCode?: string): Promise<{ seo: PageSeo }> {
	const note = await call("details:getNoteWithDetails", { id });
	const post = note ?? (await call("details:getQuestionWithDetails", { id }));
	if (!post || (requestedCode && !unitMatchesCode(post.unit, requestedCode))) {
		return { seo: notFoundSeo("Post") };
	}
	return { seo: postSeo(post) };
}

export async function loadUnitSeo(code: string): Promise<{ seo: PageSeo }> {
	const unit = await call("units:getByCode", { code });
	if (!unit) return { seo: notFoundSeo("Unit") };
	return { seo: unitSeo(unit) };
}
