<script lang="ts">
	import VoteStack from "./VoteStack.svelte";

	let {
		href,
		title,
		unitCode,
		meta,
		voteCount = 0,
		targetType,
		targetId,
	}: {
		href: string;
		title: string;
		unitCode?: string;
		meta: string;
		voteCount?: number;
		targetType: "note" | "question";
		targetId: string;
	} = $props();
</script>

<article class="border-rule flex gap-4 border-b py-5">
	<VoteStack count={voteCount} {targetType} {targetId} />
	<a {href} class="group min-w-0 flex-1">
		{#if unitCode}
			<p class="kicker">{unitCode}</p>
		{/if}
		<h3
			class="text-ink group-hover:text-primary mt-1 font-sans text-[15px] leading-snug font-semibold"
		>
			{title}
		</h3>
		<p class="kicker mt-1.5">{meta}</p>
	</a>
</article>
