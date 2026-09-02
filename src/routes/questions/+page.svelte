<script lang="ts">
	import { query } from "$lib/api";
	import { onMount } from "svelte";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import UnitFilter from "$lib/components/UnitFilter.svelte";
	import { postPath } from "$lib/paths";
	import { timeAgo } from "$lib/time";
	import type { QuestionDoc, UnitDoc } from "$lib/types";

	let questions: (QuestionDoc & { unit?: UnitDoc })[] = $state([]);
	let units: UnitDoc[] = $state([]);
	let loading = $state(true);
	let selectedUnitId = $state("");
	let sort = $state<"newest" | "top">("newest");
	let searchQuery = $state("");

	onMount(async () => {
		const [q, u] = await Promise.all([query("questions:list", {}), query("units:getAll")]);
		const unitMap = new Map((u as UnitDoc[]).map((unit) => [unit._id, unit]));
		questions = (q as QuestionDoc[]).map((question) => ({
			...question,
			unit: unitMap.get(question.unitId),
		}));
		units = u as UnitDoc[];
		loading = false;
	});

	const visible = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		let list = selectedUnitId
			? questions.filter((q) => q.unitId === selectedUnitId)
			: questions;
		if (q) {
			list = list.filter(
				(question) =>
					question.title.toLowerCase().includes(q) ||
					question.content.toLowerCase().includes(q),
			);
		}
		if (sort === "top") list = [...list].sort((a, b) => b.voteCount - a.voteCount);
		return list;
	});
</script>

<svelte:head>
	<title>Questions — Notebook</title>
</svelte:head>

<div class="page">
	<div class="border-rule flex items-end justify-between gap-4 border-b pb-6">
		<h1 class="text-ink font-serif text-4xl font-medium">Questions</h1>
		<a href="/post/question" class="btn-primary">Ask a question</a>
	</div>

	<div class="border-rule border-b py-4">
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Search questions..."
			aria-label="Search questions"
			class="field"
		/>
	</div>

	<div class="border-rule flex flex-wrap items-center justify-between gap-4 border-b py-4">
		<UnitFilter bind:selectedUnitId {units} />
		<div class="flex gap-4">
			<button
				type="button"
				class="kicker {sort === 'newest' ? 'text-ink' : ''}"
				onclick={() => (sort = "newest")}
			>
				Newest
			</button>
			<button
				type="button"
				class="kicker {sort === 'top' ? 'text-ink' : ''}"
				onclick={() => (sort = "top")}
			>
				Top
			</button>
		</div>
	</div>

	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else}
		{#each visible as question}
			<FeedRow
				href={postPath(question.unit!.code, question._id)}
				title={question.title}
				unitCode={question.unit
					? question.unit.code + (question.unit.code2 ? ` / ${question.unit.code2}` : "")
					: undefined}
				meta="{question.authorName} · {timeAgo(
					question.createdAt,
				)} · {question.answerCount} answer{question.answerCount === 1 ? '' : 's'}"
				voteCount={question.voteCount}
				targetType="question"
				targetId={question._id}
			/>
		{:else}
			<div class="py-16">
				<p class="text-muted text-sm">No questions yet.</p>
				<a
					href="/post/question"
					class="text-secondary hover:text-secondary-dark mt-4 inline-block text-sm"
					>Ask a question</a
				>
			</div>
		{/each}
	{/if}
</div>
