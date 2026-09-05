<script lang="ts">
	import { previewMarkdown } from "$lib/markdown";
	import { unitPath } from "$lib/paths";
	import ShareButton from "./ShareButton.svelte";
	import VoteStack from "./VoteStack.svelte";

	let {
		href,
		title,
		content,
		unitCode,
		meta,
		authorName,
		authorId,
		extra,
		voteCount = 0,
		targetType,
		targetId,
		tag,
	}: {
		href: string;
		title: string;
		content?: string;
		unitCode?: string;
		meta?: string;
		authorName?: string;
		authorId?: string;
		extra?: string;
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
		<div class="kicker mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
			{#if authorName}
				{#if authorId}
					<a href={`/users/${authorId}`} class="hover:text-primary">{authorName}</a>
				{:else}
					<span>{authorName}</span>
				{/if}
			{/if}
			{#if extra}
				{#if authorName}<span aria-hidden="true">·</span>{/if}
				<span>{extra}</span>
			{/if}
			{#if meta}
				{#if authorName || extra}<span aria-hidden="true">·</span>{/if}
				<span>{meta}</span>
			{/if}
			<ShareButton url={href} {title} />
		</div>
	</div>
</article>
