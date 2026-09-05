import { describe, expect, it } from "vitest";
import { postSeo, unitSeo, withSiteName } from "./seo";

describe("postSeo", () => {
	it("uses the post title and markdown preview", () => {
		const seo = postSeo({
			title: "Week 3 notes",
			content: "# Intro\n\nThese are **study** notes.",
			unit: { code: "SIT232" },
		});

		expect(seo.title).toBe(withSiteName("Week 3 notes"));
		expect(seo.description).toBe("Intro These are study notes.");
	});
});

describe("unitSeo", () => {
	it("includes unit codes, name, and description", () => {
		const seo = unitSeo({
			code: "SIT232",
			code2: "SIT772",
			name: "Object-Oriented Development",
			description: "Classes, objects, and design.",
		});

		expect(seo.title).toBe(withSiteName("SIT232 / SIT772 · Object-Oriented Development"));
		expect(seo.description).toBe("Classes, objects, and design.");
	});
});
