<script lang="ts">
	import { query } from "$lib/api";
	import { onMount } from "svelte";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import { timeAgo } from "$lib/time";
	import type { NoteDoc, UnitDoc } from "$lib/types";

	let notes: (NoteDoc & { unit?: UnitDoc })[] = $state([]);
	let units: UnitDoc[] = $state([]);
	let loading = $state(true);
	let selectedUnitId = $state("");
	let sort = $state<"newest" | "top">("newest");

	onMount(async () => {
		const [n, u] = await Promise.all([query("notes:list", {}), query("units:getAll")]);
		const unitMap = new Map((u as UnitDoc[]).map((unit) => [unit._id, unit]));
		notes = (n as NoteDoc[]).map((note) => ({ ...note, unit: unitMap.get(note.unitId) }));
		units = u as UnitDoc[];
		loading = false;
	});

	const usedUnits = $derived.by(() => {
		const ids = new Set(notes.map((n) => n.unitId));
		return units.filter((u) => ids.has(u._id));
	});

	const visible = $derived.by(() => {
		let list = selectedUnitId ? notes.filter((n) => n.unitId === selectedUnitId) : notes;
		if (sort === "top") list = [...list].sort((a, b) => b.voteCount - a.voteCount);
		return list;
	});
</script>

<svelte:head>
	<title>Notes — Notebook</title>
</svelte:head>

<div class="page">
	<div class="border-rule flex items-end justify-between gap-4 border-b pb-6">
		<h1 class="text-ink font-serif text-4xl font-medium">Notes</h1>
		<a href="/post/note" class="btn-primary">Post a note</a>
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
		{#each visible as note}
			<FeedRow
				href="/notes/{note._id}"
				title={note.title}
				unitCode={note.unit
					? note.unit.code + (note.unit.code2 ? ` / ${note.unit.code2}` : "")
					: undefined}
				meta="{note.authorName} · {timeAgo(
					note.createdAt,
				)} · {note.commentCount} comment{note.commentCount === 1 ? '' : 's'}"
				voteCount={note.voteCount}
				targetType="note"
				targetId={note._id}
			/>
		{:else}
			<div class="py-16">
				<p class="text-muted text-sm">No notes yet.</p>
				<a
					href="/post/note"
					class="text-secondary hover:text-secondary-dark mt-4 inline-block text-sm"
					>Post a note</a
				>
			</div>
		{/each}
	{/if}
</div>
