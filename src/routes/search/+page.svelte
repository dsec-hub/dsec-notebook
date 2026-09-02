<script lang="ts">
	import { query } from "$lib/api";
	import { onMount } from "svelte";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import { postPath } from "$lib/paths";
	import { timeAgo } from "$lib/time";
	import type { SearchResult } from "$lib/types";

	let results: SearchResult[] = $state([]);
	let loading = $state(true);
	let searchQuery = $state("");
	let ranQuery = $state(false);

	onMount(async () => {
		searchQuery = new URL(window.location.href).searchParams.get("q") ?? "";
		if (searchQuery) {
			ranQuery = true;
			results = (await query("search:all", { query: searchQuery })) as SearchResult[];
		}
		loading = false;
	});
</script>

<svelte:head>
	<title>{searchQuery ? `Search: ${searchQuery}` : "Search"} — Notebook</title>
</svelte:head>

<div class="page">
	<h1 class="text-ink font-serif text-4xl font-medium">Search</h1>
	<form
		class="border-rule mt-6 mb-8 border-b pb-8"
		onsubmit={(e) => {
			e.preventDefault();
			const q = searchQuery.trim();
			if (!q) return;
			window.location.href = `/search?q=${encodeURIComponent(q)}`;
		}}
	>
		<label for="q" class="kicker mb-2 block">Query</label>
		<input
			id="q"
			type="search"
			bind:value={searchQuery}
			placeholder="Search notes and questions..."
			class="field"
		/>
	</form>

	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if ranQuery}
		{#each results as result}
			{#if result.type === "note"}
				<FeedRow
					href={postPath(result.unit!.code, result._id)}
					title={result.title}
					content={result.content}
					unitCode={result.unit
						? result.unit.code + (result.unit.code2 ? ` / ${result.unit.code2}` : "")
						: undefined}
					meta="{result.authorName} · {timeAgo(
						result.createdAt,
					)} · {result.commentCount} comment{result.commentCount === 1 ? '' : 's'}"
					voteCount={result.voteCount}
					targetType="note"
					targetId={result._id}
					tag="Note"
				/>
			{:else}
				<FeedRow
					href={postPath(result.unit!.code, result._id)}
					title={result.title}
					content={result.content}
					unitCode={result.unit
						? result.unit.code + (result.unit.code2 ? ` / ${result.unit.code2}` : "")
						: undefined}
					meta="{result.authorName} · {timeAgo(
						result.createdAt,
					)} · {result.answerCount} answer{result.answerCount === 1 ? '' : 's'}"
					voteCount={result.voteCount}
					targetType="question"
					targetId={result._id}
					tag="Question"
				/>
			{/if}
		{:else}
			<p class="text-muted text-sm">No results found for “{searchQuery}”.</p>
		{/each}
	{/if}
</div>
