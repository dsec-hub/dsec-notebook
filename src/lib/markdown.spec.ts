import { describe, expect, it } from "vitest";
import { previewMarkdown } from "./markdown";

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
