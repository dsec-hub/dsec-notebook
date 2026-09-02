<script lang="ts">
	import { query } from "$lib/api";
	import { onMount } from "svelte";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import UnitRail from "$lib/components/UnitRail.svelte";
	import { postPath } from "$lib/paths";
	import { timeAgo } from "$lib/time";
	import type { NoteDoc, QuestionDoc, UnitDoc } from "$lib/types";

	let units: UnitDoc[] = $state([]);
	let notes: NoteDoc[] = $state([]);
	let questions: QuestionDoc[] = $state([]);
	let loading = $state(true);
	let contentLoading = $state(false);
	let selectedUnitId = $state("");

	const selectedUnit = $derived(units.find((u) => u._id === selectedUnitId) ?? null);

	onMount(async () => {
		try {
			units = (await query("units:getAll")) as UnitDoc[];
			selectedUnitId = units[0]?._id ?? "";
		} finally {
			loading = false;
		}
	});

	$effect(() => {
		loadContent(selectedUnitId);
	});

	async function loadContent(id: string) {
		if (!id) {
			notes = [];
			questions = [];
			return;
		}
		contentLoading = true;
		try {
			const [n, q] = await Promise.all([
				query("notes:list", { unitId: id }),
				query("questions:list", { unitId: id }),
			]);
			notes = n as NoteDoc[];
			questions = q as QuestionDoc[];
		} finally {
			contentLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Units — Notebook</title>
</svelte:head>

<div class="page">
	<div class="border-rule border-b pb-6">
		<h1 class="text-ink font-serif text-4xl font-medium">Units</h1>
		<p class="text-muted mt-2 text-sm">
			Browse notes and questions by unit. Pin the units you are studying to keep them handy.
		</p>
	</div>

	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else}
		<div class="border-rule border-b py-5">
			<UnitRail {units} bind:selectedUnitId />
		</div>

		{#if selectedUnit}
			<div class="pt-6">
				<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
					<a
						href={`/${selectedUnit.code}`}
						class="text-ink hover:text-primary font-serif text-2xl font-medium"
					>
						{selectedUnit.code}{selectedUnit.code2 ? ` / ${selectedUnit.code2}` : ""}
					</a>
					<p class="text-muted text-sm">{selectedUnit.name}</p>
				</div>
				{#if selectedUnit.description}
					<p class="text-muted mt-1 text-sm">
						{selectedUnit.description}
					</p>
				{/if}

				{#if contentLoading}
					<p class="kicker py-16">Loading</p>
				{:else}
					{#if notes.length > 0}
						<p class="kicker border-rule mt-8 border-t pt-8">Notes</p>
						{#each notes as note}
							<FeedRow
								href={postPath(selectedUnit.code, note._id)}
								title={note.title}
								content={note.content}
								unitCode={selectedUnit.code +
									(selectedUnit.code2 ? ` / ${selectedUnit.code2}` : "")}
								meta="{note.authorName} · {timeAgo(
									note.createdAt,
								)} · {note.commentCount} comment{note.commentCount === 1
									? ''
									: 's'}"
								voteCount={note.voteCount}
								targetType="note"
								targetId={note._id}
							/>
						{/each}
					{/if}

					{#if questions.length > 0}
						<p class="kicker border-rule mt-8 border-t pt-8">Questions</p>
						{#each questions as question}
							<FeedRow
								href={postPath(selectedUnit.code, question._id)}
								title={question.title}
								content={question.content}
								unitCode={selectedUnit.code +
									(selectedUnit.code2 ? ` / ${selectedUnit.code2}` : "")}
								meta="{question.authorName} · {timeAgo(
									question.createdAt,
								)} · {question.answerCount} answer{question.answerCount === 1
									? ''
									: 's'}"
								voteCount={question.voteCount}
								targetType="question"
								targetId={question._id}
							/>
						{/each}
					{/if}

					{#if notes.length === 0 && questions.length === 0}
						<p class="text-muted mt-8 text-sm">No content for this unit yet.</p>
						<div class="mt-4 flex gap-4">
							<a
								href="/post/note"
								class="text-secondary hover:text-secondary-dark text-sm"
								>Post a note</a
							>
							<a
								href="/post/question"
								class="text-secondary hover:text-secondary-dark text-sm"
								>Ask a question</a
							>
						</div>
					{/if}
				{/if}
			</div>
		{:else}
			<p class="text-muted py-16 text-sm">Select a unit to see its notes and questions.</p>
		{/if}
	{/if}
</div>
