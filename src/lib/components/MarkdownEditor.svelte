<script lang="ts">
	import { tick } from "svelte";
	import Markdown from "./Markdown.svelte";
	import { getToken } from "$lib/stores/auth";
	import { uploadImage } from "$lib/api";

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
	let fileInput: HTMLInputElement | undefined = $state();
	let mode = $state<"write" | "preview">("write");
	let uploading = $state(false);
	let uploadError = $state("");

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

	function insertText(text: string) {
		applyEdit((value, start, end) => {
			const next = value.slice(0, start) + text + value.slice(end);
			return { value: next, start: start + text.length, end: start + text.length };
		});
	}

	async function uploadFiles(files: File[]) {
		const token = getToken();
		if (!token) {
			uploadError = "Please sign in to upload images";
			return;
		}

		uploading = true;
		uploadError = "";
		try {
			const urls: string[] = [];
			for (const file of files) {
				urls.push(await uploadImage(token, file));
			}
			insertText(urls.map((url) => `![image](${url})`).join("\n\n"));
		} catch (err: any) {
			uploadError = err?.message ?? "Failed to upload image";
		} finally {
			uploading = false;
		}
	}

	function pickImages() {
		fileInput?.click();
	}

	async function onFilesSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = input.files ? Array.from(input.files) : [];
		if (files.length > 0) await uploadFiles(files);
		input.value = "";
	}

	function handlePaste(event: ClipboardEvent) {
		const data = event.clipboardData;
		if (!data) return;

		const files: File[] = [];
		for (let i = 0; i < data.items.length; i++) {
			const item = data.items[i];
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file && file.type.startsWith("image/")) files.push(file);
			}
		}
		if (files.length === 0) return;

		event.preventDefault();
		void uploadFiles(files);
	}
</script>

<div>
	{#if label}
		<label for="markdown-editor" class="kicker mb-2 block">{label}</label>
	{/if}

	<div class="border-rule w-fit border-t border-r border-l">
		<button
			type="button"
			class="{mode === 'write'
				? 'text-primary'
				: 'hover:text-primary'} border-rule border-r px-2 py-2 text-sm"
			onclick={() => (mode = "write")}
		>
			Write
		</button>
		<button
			type="button"
			class="{mode === 'preview' ? 'text-primary' : 'hover:text-primary'} px-2 py-2 text-sm"
			onclick={() => (mode = "preview")}
		>
			Preview
		</button>
	</div>

	{#if mode === "write"}
		<div class="border-rule bg-surface flex flex-wrap items-center gap-1 rounded-sm border p-1">
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
			<button
				type="button"
				class="editor-tool"
				title="Insert image"
				onclick={pickImages}
				disabled={uploading}
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<rect x="3" y="3" width="18" height="18" rx="2"></rect>
					<circle cx="8.5" cy="8.5" r="1.5"></circle>
					<path d="M21 15l-5-5L5 21"></path>
				</svg>
			</button>
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
		<textarea
			id="markdown-editor"
			bind:this={textarea}
			bind:value={content}
			{rows}
			{placeholder}
			onpaste={handlePaste}
			class="field resize-y"></textarea>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			class="hidden"
			onchange={onFilesSelected}
		/>
		<p class="text-faint mt-2 text-xs">
			Markdown supported: **bold**, _italic_, `code`, [links](url), lists, quotes and code
			blocks. Paste or insert images to embed them.
		</p>
		{#if uploading}
			<p class="text-muted mt-1 text-xs">Uploading image...</p>
		{/if}
		{#if uploadError}
			<p class="text-primary mt-1 text-xs">{uploadError}</p>
		{/if}
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
