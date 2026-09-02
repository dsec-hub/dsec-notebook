<script lang="ts">
	import { previewMarkdown } from "$lib/markdown";
	import { unitPath } from "$lib/paths";
	import VoteStack from "./VoteStack.svelte";

	let {
		href,
		title,
		content,
		unitCode,
		meta,
		voteCount = 0,
		targetType,
		targetId,
		tag,
	}: {
		href: string;
		title: string;
		content?: string;
		unitCode?: string;
		meta: string;
		voteCount?: number;
		targetType: "note" | "question";
		targetId: string;
		tag?: string;
	} = $props();
</script>

<article class="border-rule flex gap-4 border-b py-5">
	<VoteStack count={voteCount} {targetType} {targetId} />
	<div class="group min-w-0 flex-1">
		{#if tag}
			<p class="text-secondary mb-1 text-[10px] font-semibold tracking-[0.16em] uppercase">
				{tag}
			</p>
		{/if}
		{#if unitCode}
			<a href={unitPath(unitCode.split(" / ")[0])} class="kicker">{unitCode}</a><br />
		{/if}
		<a
			{href}
			class="text-ink hover:text-primary mt-1 font-sans text-[15px] leading-snug font-semibold"
		>
			{title}
		</a>
		{#if content?.trim()}
			<p class="text-muted mt-1 line-clamp-2 text-sm leading-relaxed">
				{previewMarkdown(content)}
			</p>
		{/if}
		<p class="kicker mt-1.5">{meta}</p>
	</div>
</article>
