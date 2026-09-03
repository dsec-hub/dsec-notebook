declare module "markdown-it-texmath" {
	import type MarkdownIt from "markdown-it";
	import type katex from "katex";

	type Delimiter =
		| "dollars"
		| "brackets"
		| "doxygen"
		| "gitlab"
		| "julia"
		| "kramdown"
		| "beg_end";

	interface TexmathOptions {
		engine: typeof katex;
		delimiters?: Delimiter | Delimiter[];
		katexOptions?: katex.KatexOptions;
	}

	const texmath: MarkdownIt.PluginWithOptions<TexmathOptions>;
	export default texmath;
}
