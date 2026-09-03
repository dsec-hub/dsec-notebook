import { describe, expect, it } from "vitest";
import { previewMarkdown, renderMarkdown } from "./markdown";

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
