<script lang="ts">
	import { query } from "$lib/api";
	import { onMount } from "svelte";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import { timeAgo } from "$lib/time";
	import type { QuestionDoc, UnitDoc } from "$lib/types";

	let questions: (QuestionDoc & { unit?: UnitDoc })[] = $state([]);
	let units: UnitDoc[] = $state([]);
	let loading = $state(true);
	let selectedUnitId = $state("");
	let sort = $state<"newest" | "top">("newest");

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

	const usedUnits = $derived.by(() => {
		const ids = new Set(questions.map((q) => q.unitId));
		return units.filter((u) => ids.has(u._id));
	});

	const visible = $derived.by(() => {
		let list = selectedUnitId
			? questions.filter((q) => q.unitId === selectedUnitId)
			: questions;
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

	<div class="border-rule flex flex-wrap items-center justify-between gap-4 border-b py-4">
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				class="chip {selectedUnitId === '' ? 'chip-active' : ''}"
				onclick={() => (selectedUnitId = "")}
			>
				All units
			</button>
			{#each usedUnits as unit}
				<button
					type="button"
					class="chip {selectedUnitId === unit._id ? 'chip-active' : ''}"
					onclick={() => (selectedUnitId = unit._id)}
				>
					{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}
				</button>
			{/each}
		</div>
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
				href="/questions/{question._id}"
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
