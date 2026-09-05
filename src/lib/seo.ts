import { previewMarkdown } from "$lib/markdown";

export const SITE_NAME = "Notebook";
export const SITE_DESCRIPTION =
	"A resource hub for Deakin University students. Shared study notes, questions and answers for SIT and Mathematics units.";

export type PageSeo = {
	title: string;
	description: string;
};

export function withSiteName(title: string): string {
	return `${title} — ${SITE_NAME}`;
}

function unitLabel(unit: { code: string; code2?: string }): string {
	return unit.code2 ? `${unit.code} / ${unit.code2}` : unit.code;
}

export function postSeo(post: {
	title: string;
	content: string;
	unit?: { code: string; code2?: string } | null;
}): PageSeo {
	const preview = previewMarkdown(post.content);
	const unit = post.unit ? unitLabel(post.unit) : "";
	const description =
		preview ||
		(unit ? `${post.title} — ${unit} on DSEC Notebook.` : `${post.title} on DSEC Notebook.`);

	return {
		title: withSiteName(post.title),
		description,
	};
}

export function unitSeo(unit: {
	code: string;
	code2?: string;
	name: string;
	description?: string;
}): PageSeo {
	const codes = unitLabel(unit);
	const description =
		unit.description?.trim() ||
		`Notes and questions for ${unit.name} (${codes}) on DSEC Notebook.`;

	return {
		title: withSiteName(`${codes} · ${unit.name}`),
		description,
	};
}

export function notFoundSeo(kind: "Post" | "Unit"): PageSeo {
	return {
		title: withSiteName(`${kind} not found`),
		description: SITE_DESCRIPTION,
	};
}
