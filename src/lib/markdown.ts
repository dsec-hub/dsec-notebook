import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
});

export function renderMarkdown(source: string): string {
	return md.render(source ?? "");
}

export function previewMarkdown(source: string, maxLength = 180): string {
	const text = md
		.parse(source ?? "", {})
		.map((token) => {
			console.log(token);
			if (token.type === "inline") {
				return (token.children ?? [])
					.filter((child) => child.type !== "image")
					.map((child) =>
						child.type === "softbreak" || child.type === "hardbreak"
							? " "
							: child.content,
					)
					.join("");
			}

			if (token.type === "fence" || token.type === "code_block") return token.content;
			return "";
		})
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();

	if (text.length <= maxLength) return text;
	return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
