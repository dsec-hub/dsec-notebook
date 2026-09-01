<script lang="ts">
	import { tick } from "svelte";
	import Markdown from "./Markdown.svelte";

	let {
		content = $bindable(""),
		label = "Content",
		placeholder = "",
		rows = 10,
	}: {
		content?: string;
		label?: string;
		placeholder?: string;
		rows?: number;
	} = $props();

	let textarea: HTMLTextAreaElement | undefined = $state();
	let mode = $state<"write" | "preview">("write");

	function selection(): { start: number; end: number; text: string } {
		if (!textarea) return { start: content.length, end: content.length, text: "" };
		const start = textarea.selectionStart ?? content.length;
		const end = textarea.selectionEnd ?? content.length;
		return { start, end, text: content.slice(start, end) };
	}

	function applyEdit(
		build: (
			value: string,
			start: number,
			end: number,
		) => {
			value: string;
			start: number;
			end: number;
		},
	) {
		const { start, end } = selection();
		const result = build(content, start, end);
		content = result.value;
		void tick().then(() => {
			if (!textarea) return;
			textarea.focus();
			textarea.setSelectionRange(result.start, result.end);
		});
	}

	function wrap(before: string, after = before) {
		const { start, end, text } = selection();
		applyEdit((value) => {
			const next = value.slice(0, start) + before + text + after + value.slice(end);
			return {
				value: next,
				start: start + before.length,
				end: start + before.length + text.length,
			};
		});
	}

	function prefixLines(prefix: string) {
		const { start, end } = selection();
		applyEdit((value) => {
			const lineStart = value.lastIndexOf("\n", start - 1) + 1;
			let lineEnd = end;
			if (start === end) {
				const nextNewline = value.indexOf("\n", end);
				lineEnd = nextNewline === -1 ? value.length : nextNewline;
			}
			const block = value.slice(lineStart, lineEnd);
			const prefixed = block
				.split("\n")
				.map((line) => prefix + line)
				.join("\n");
			return {
				value: value.slice(0, lineStart) + prefixed + value.slice(lineEnd),
				start: lineStart,
				end: lineStart + prefixed.length,
			};
		});
	}

	function insertLink() {
		const { start, end, text } = selection();
		const label = text || "link text";
		const insertion = `[${label}](url)`;
		applyEdit((value) => {
			const next = value.slice(0, start) + insertion + value.slice(end);
			const selectStart = start + insertion.length - 4;
			const selectEnd = start + insertion.length - 1;
			return { value: next, start: selectStart, end: selectEnd };
		});
	}

	function insertCodeBlock() {
		const { start, end, text } = selection();
		applyEdit((value) => {
			const next = value.slice(0, start) + "```\n" + text + "\n```" + value.slice(end);
			return {
				value: next,
				start: start + 4,
				end: start + 4 + text.length,
			};
		});
	}
</script>

<div>
	{#if label}
		<label for="markdown-editor" class="kicker mb-2 block">{label}</label>
	{/if}

	{#if mode === "write"}
		<div
			class="border-rule bg-surface mb-2 flex flex-wrap items-center gap-1 rounded-sm border p-1"
		>
			<button type="button" class="editor-tool" title="Bold" onclick={() => wrap("**")}>
				<strong>B</strong>
			</button>
			<button type="button" class="editor-tool" title="Italic" onclick={() => wrap("_")}>
				<em>I</em>
			</button>
			<button
				type="button"
				class="editor-tool"
				title="Strikethrough"
				onclick={() => wrap("~~")}
			>
				<s>S</s>
			</button>
			<button type="button" class="editor-tool" title="Inline code" onclick={() => wrap("`")}>
				&lt;/&gt;
			</button>
			<button
				type="button"
				class="editor-tool"
				title="Heading"
				onclick={() => prefixLines("## ")}
			>
				H
			</button>
			<button type="button" class="editor-tool" title="Link" onclick={insertLink}>🔗</button>
			<button type="button" class="editor-tool" title="Code block" onclick={insertCodeBlock}>
				{`{ }`}
			</button>
			<button
				type="button"
				class="editor-tool"
				title="Bullet list"
				onclick={() => prefixLines("- ")}
			>
				• List
			</button>
			<button
				type="button"
				class="editor-tool"
				title="Blockquote"
				onclick={() => prefixLines("> ")}
			>
				❝
			</button>
		</div>
	{/if}

	<div class="border-rule mb-2 flex items-center gap-2 border-b">
		<button
			type="button"
			class="kicker {mode === 'write'
				? 'text-ink'
				: 'hover:text-primary'} border-b-2 border-transparent pb-2"
			onclick={() => (mode = "write")}
		>
			Write
		</button>
		<button
			type="button"
			class="kicker {mode === 'preview'
				? 'text-ink'
				: 'hover:text-primary'} border-b-2 border-transparent pb-2"
			onclick={() => (mode = "preview")}
		>
			Preview
		</button>
	</div>

	{#if mode === "write"}
		<textarea
			id="markdown-editor"
			bind:this={textarea}
			bind:value={content}
			{rows}
			{placeholder}
			class="field resize-y"></textarea>
		<p class="text-faint mt-2 text-xs">
			Markdown supported: **bold**, _italic_, `code`, [links](url), lists, quotes and code
			blocks.
		</p>
	{:else}
		<div
			class="border-rule bg-surface text-ink min-h-40 rounded-sm border px-3 py-2.5 text-sm leading-relaxed"
		>
			{#if content.trim()}
				<Markdown {content} />
			{:else}
				<p class="text-faint">Nothing to preview yet.</p>
			{/if}
		</div>
	{/if}
</div>
