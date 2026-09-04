import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import katex from "katex";
import hljs from "highlight.js/lib/common";

const md = new MarkdownIt({
	html: false,
	linkify: true,
	breaks: true,
	highlight: highlightCode,
});

md.use(texmath, {
	engine: katex,
	delimiters: ["dollars", "brackets"],
	katexOptions: {
		throwOnError: false,
		output: "htmlAndMathml",
	},
});

function highlightCode(source: string, lang: string): string {
	const language = lang.trim().toLowerCase();
	const escapedLang = language ? md.utils.escapeHtml(language) : "";
	let highlighted = md.utils.escapeHtml(source);

	if (language && hljs.getLanguage(language)) {
		try {
			highlighted = hljs.highlight(source, { language, ignoreIllegals: true }).value;
		} catch {
			highlighted = md.utils.escapeHtml(source);
		}
	}

	const langClass = escapedLang ? ` language-${escapedLang}` : "";
	const langAttr = escapedLang ? ` data-lang="${escapedLang}"` : "";

	return `<pre class="code-block"${langAttr}>${COPY_BUTTON}<code class="hljs${langClass}">${highlighted}</code></pre>`;
}

const COPY_BUTTON = `<button type="button" class="code-copy" aria-label="Copy code" title="Copy">
<svg class="code-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
<svg class="code-copy-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"></path></svg>
</button>`;

export function renderMarkdown(source: string): string {
	return md.render(source ?? "");
}

export function previewMarkdown(source: string, maxLength = 180): string {
	const text = md
		.parse(source ?? "", {})
		.map((token) => {
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
