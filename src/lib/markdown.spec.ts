import { describe, expect, it } from "vitest";
import { collectInternalPostIds, previewMarkdown, renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
	it("renders inline and display LaTeX with KaTeX", () => {
		const rendered = renderMarkdown("Euler: $e^{i\\pi} + 1 = 0$\n\n$$\n\\frac{a}{b}\n$$");

		expect(rendered).toContain('class="katex"');
		expect(rendered).toContain('class="katex-display"');
		expect(rendered).toContain("e^{i\\pi} + 1 = 0");
		expect(rendered).toContain("\\frac{a}{b}");
	});

	it("renders invalid LaTeX as an error instead of throwing", () => {
		expect(() => renderMarkdown("$\\notacommand{$")).not.toThrow();
	});

	it("syntax-highlights fenced code blocks", () => {
		const rendered = renderMarkdown("```ts\nconst value: number = 1;\n```");

		expect(rendered).toContain('class="code-block"');
		expect(rendered).toContain('class="code-copy"');
		expect(rendered).toContain('data-lang="ts"');
		expect(rendered).toContain("hljs");
		expect(rendered).toContain("hljs-keyword");
		expect(rendered).not.toContain("code-lang");
		expect(rendered).not.toContain("<script");
	});

	it("escapes unhighlighted fenced code", () => {
		const rendered = renderMarkdown("```\n<div>&</div>\n```");

		expect(rendered).toContain("&lt;div&gt;");
		expect(rendered).toContain("&amp;");
		expect(rendered).not.toContain("<div>");
	});

	it("styles same-origin and relative links as internal bubbles", () => {
		const origin = "https://notebook.example";
		const relative = renderMarkdown("[details](/SIT223/abc)", { origin });
		const absolute = renderMarkdown(`[details](${origin}/notes/abc)`, { origin });
		const external = renderMarkdown("[site](https://example.com/notes/abc)", { origin });

		expect(relative).toContain('class="md-internal"');
		expect(relative).toContain('href="/SIT223/abc"');
		expect(absolute).toContain('class="md-internal"');
		expect(absolute).toContain('href="/notes/abc"');
		expect(external).not.toContain("md-internal");
		expect(external).toContain('href="https://example.com/notes/abc"');
	});

	it("uses a short label for autolinked internal urls", () => {
		const origin = "https://notebook.example";
		const rendered = renderMarkdown(`${origin}/questions/abc`, { origin });

		expect(rendered).toContain('class="md-internal"');
		expect(rendered).toContain("Question");
		expect(rendered).not.toContain(`${origin}/questions/abc<`);
	});

	it("labels autolinked unit posts with the post title when provided", () => {
		const rendered = renderMarkdown("[/SIT223/abc-id](/SIT223/abc-id)", {
			titles: { "abc-id": "Week 3 notes" },
		});

		expect(rendered).toContain("Week 3 notes");
		expect(rendered).not.toContain("SIT223 post");
	});

	it("falls back to a unit post label without a title", () => {
		expect(renderMarkdown("[/SIT223/abc-id](/SIT223/abc-id)")).toContain("SIT223 post");
	});

	it("keeps custom link text on internal bubbles", () => {
		const rendered = renderMarkdown("[Week 3 notes](/notes/abc)", {
			titles: { abc: "Actual title" },
		});
		expect(rendered).toContain("Week 3 notes");
		expect(rendered).toContain('class="md-internal"');
		expect(rendered).not.toContain("Actual title");
	});

	it("collects autolinked post ids for title lookup", () => {
		const origin = "https://notebook.example";
		expect(
			collectInternalPostIds(
				`${origin}/SIT223/unit-post\n${origin}/notes/note-id\n[custom](/questions/q-id)`,
				origin,
			),
		).toEqual(["unit-post", "note-id"]);
	});
});

describe("previewMarkdown", () => {
	it("returns readable text without markdown formatting", () => {
		expect(previewMarkdown("# Heading\n\nA **bold** [link](https://example.com).")).toBe(
			"Heading A bold link.",
		);
	});

	it("includes code and truncates long previews", () => {
		expect(previewMarkdown("Use `const value = 1` here.", 18)).toBe("Use const value =…");
	});
});
