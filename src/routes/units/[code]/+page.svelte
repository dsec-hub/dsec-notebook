<script lang="ts">
	import { mutation, query } from "$lib/api";
	import { page } from "$app/state";
	import { get } from "svelte/store";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import { postPath } from "$lib/paths";
	import { getToken, initAuth, isAuthenticated } from "$lib/stores/auth";
	import Seo from "$lib/components/Seo.svelte";
	import { unitSeo } from "$lib/seo";
	import { timeAgo } from "$lib/time";
	import type { NoteDoc, QuestionDoc, UnitDoc } from "$lib/types";

	const MAX_PINS = 10;

	let unit = $state<UnitDoc | null>(null);
	let notes: NoteDoc[] = $state([]);
	let questions: QuestionDoc[] = $state([]);
	let loading = $state(true);
	let authed = $state(false);
	let pinnedIds = $state<string[]>([]);
	let pinBusy = $state(false);
	let pinError = $state("");
	let searchQuery = $state("");

	const isPinned = $derived(unit ? pinnedIds.includes(unit._id) : false);
	const canPin = $derived(isPinned || pinnedIds.length < MAX_PINS);
	const seo = $derived.by(() => (unit ? unitSeo(unit) : page.data.seo));

	const visibleNotes = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return notes;
		return notes.filter(
			(note) =>
				note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q),
		);
	});
	const visibleQuestions = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return questions;
		return questions.filter(
			(question) =>
				question.title.toLowerCase().includes(q) ||
				question.content.toLowerCase().includes(q),
		);
	});

	$effect(() => {
		const code = page.params.code;
		let cancelled = false;
		loading = true;
		unit = null;

		void (async () => {
			await initAuth();
			if (cancelled) return;
			authed = get(isAuthenticated);
			const token = getToken();
			const u = await query("units:getByCode", { code });
			if (cancelled) return;
			unit = u as UnitDoc;
			if (unit) {
				const [n, q, pins] = await Promise.all([
					query("notes:list", { unitId: unit._id }),
					query("questions:list", { unitId: unit._id }),
					token ? query("units:getPinned", { token }) : Promise.resolve([]),
				]);
				if (cancelled) return;
				notes = n as NoteDoc[];
				questions = q as QuestionDoc[];
				pinnedIds = pins as string[];
			}
			loading = false;
		})();

		return () => {
			cancelled = true;
		};
	});

	async function togglePin() {
		if (!unit) return;

		const token = getToken();
		if (!token) {
			pinError = "Sign in to pin units";
			return;
		}

		pinBusy = true;
		pinError = "";
		try {
			pinnedIds = (await mutation(isPinned ? "units:unpin" : "units:pin", {
				token,
				unitId: unit._id,
			})) as string[];
		} catch (err: any) {
			pinError = err?.message ?? "Failed to update pin";
		} finally {
			pinBusy = false;
		}
	}
</script>

<Seo {seo} />

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if unit}
		<p class="kicker">
			<a href="/" class="hover:text-primary">Home</a> · Unit
		</p>
		<div class="mt-2 flex items-center gap-2">
			<h1 class="text-ink font-serif text-4xl font-medium">
				{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}
			</h1>
			{#if authed}
				<button
					type="button"
					class="pin-btn {isPinned ? 'pin-btn-active' : ''}"
					onclick={togglePin}
					disabled={pinBusy || !canPin}
					title={isPinned
						? "Unpin unit"
						: canPin
							? "Pin unit"
							: "You can pin up to 10 units"}
					aria-label={isPinned ? "Unpin unit" : "Pin unit"}
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M12 17v5"></path>
						<path
							d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"
						></path>
					</svg>
				</button>
			{/if}
		</div>
		<p class="text-muted mt-1 text-[15px]">{unit.name}</p>
		{#if unit.description}
			<p class="text-muted mt-2 text-sm">{unit.description}</p>
		{/if}
		{#if pinError}
			<p class="text-primary mt-2 text-xs">{pinError}</p>
		{/if}

		{#if notes.length > 0 || questions.length > 0}
			<div class="border-rule mt-8 border-t py-4">
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search this unit..."
					aria-label="Search this unit"
					class="field"
				/>
			</div>
		{/if}

		{#if visibleNotes.length > 0}
			<p class="kicker border-rule mt-6 border-t pt-8">Notes</p>
			{#each visibleNotes as note}
				<FeedRow
					href={postPath(unit.code, note._id)}
					title={note.title}
					content={note.content}
					unitCode={unit.code + (unit.code2 ? ` / ${unit.code2}` : "")}
					meta={note.commentCount > 0
						? `${timeAgo(note.createdAt)} · ${note.commentCount} comment${note.commentCount === 1 ? "" : "s"}`
						: timeAgo(note.createdAt)}
					voteCount={note.voteCount}
					targetType="note"
					targetId={note._id}
				/>
			{/each}
		{/if}

		{#if visibleQuestions.length > 0}
			<p class="kicker border-rule mt-10 border-t pt-8">Questions</p>
			{#each visibleQuestions as question}
				<FeedRow
					href={postPath(unit.code, question._id)}
					title={question.title}
					content={question.content}
					unitCode={unit.code + (unit.code2 ? ` / ${unit.code2}` : "")}
					meta={question.answerCount > 0
						? `${question.authorName} · ${timeAgo(question.createdAt)} · ${question.answerCount} answer${question.answerCount === 1 ? "" : "s"}`
						: `${question.authorName} · ${timeAgo(question.createdAt)}`}
					voteCount={question.voteCount}
					targetType="question"
					targetId={question._id}
				/>
			{/each}
		{/if}

		{#if notes.length === 0 && questions.length === 0}
			<p class="text-muted mt-10 text-sm">No content for this unit yet.</p>
			<div class="mt-4 flex gap-4">
				<a href="/post/note" class="text-secondary hover:text-secondary-dark text-sm"
					>Post a note</a
				>
				<a href="/post/question" class="text-secondary hover:text-secondary-dark text-sm"
					>Ask a question</a
				>
			</div>
		{:else if searchQuery.trim() && visibleNotes.length === 0 && visibleQuestions.length === 0}
			<p class="text-muted mt-6 text-sm">
				No results in this unit for “{searchQuery.trim()}”.
			</p>
		{/if}
	{:else}
		<h1 class="text-ink font-serif text-3xl">Unit not found</h1>
		<a href="/" class="text-secondary hover:text-secondary-dark mt-2 inline-block text-sm"
			>Home</a
		>
	{/if}
</div>
