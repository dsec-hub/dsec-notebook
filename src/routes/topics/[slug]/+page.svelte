<script lang="ts">
	import { query } from "$lib/api";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import FeedRow from "$lib/components/FeedRow.svelte";
	import { postPath } from "$lib/paths";
	import { timeAgo } from "$lib/time";
	import type { NoteDoc, QuestionDoc, TopicDoc } from "$lib/types";

	let topic: TopicDoc | null = $state(null);
	let notes: NoteDoc[] = $state([]);
	let questions: QuestionDoc[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		const slug = page.params.slug;
		const t = await query("topics:getBySlug", { slug });
		topic = t as TopicDoc;
		if (topic) {
			const [n, q] = await Promise.all([
				query("notes:list", { topicId: topic._id }),
				query("questions:list", { topicId: topic._id }),
			]);
			notes = n as NoteDoc[];
			questions = q as QuestionDoc[];
		}
		loading = false;
	});
</script>

<svelte:head>
	<title>{topic?.name ?? "Topic"} — Notebook</title>
</svelte:head>

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if topic}
		<p class="kicker"><a href="/" class="hover:text-primary">Home</a> · Topic</p>
		<h1 class="text-ink mt-2 font-serif text-4xl font-medium">{topic.name}</h1>
		{#if topic.description}
			<p class="text-muted mt-2 text-[15px]">{topic.description}</p>
		{/if}

		{#if notes.length > 0}
			<p class="kicker border-rule mt-10 border-t pt-8">Notes</p>
			{#each notes as note}
				<FeedRow
					href={postPath(note.unit!.code, note._id)}
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
			{/each}
		{/if}

		{#if questions.length > 0}
			<p class="kicker border-rule mt-10 border-t pt-8">Questions</p>
			{#each questions as question}
				<FeedRow
					href={postPath(question.unit!.code, question._id)}
					title={question.title}
					unitCode={question.unit
						? question.unit.code +
							(question.unit.code2 ? ` / ${question.unit.code2}` : "")
						: undefined}
					meta="{question.authorName} · {timeAgo(
						question.createdAt,
					)} · {question.answerCount} answer{question.answerCount === 1 ? '' : 's'}"
					voteCount={question.voteCount}
					targetType="question"
					targetId={question._id}
				/>
			{/each}
		{/if}

		{#if notes.length === 0 && questions.length === 0}
			<p class="text-muted mt-10 text-sm">No content in this topic yet.</p>
			<div class="mt-4 flex gap-4">
				<a href="/post/note" class="text-secondary hover:text-secondary-dark text-sm"
					>Post a note</a
				>
				<a href="/post/question" class="text-secondary hover:text-secondary-dark text-sm"
					>Ask a question</a
				>
			</div>
		{/if}
	{:else}
		<h1 class="text-ink font-serif text-3xl">Topic not found</h1>
		<a href="/" class="text-secondary hover:text-secondary-dark mt-2 inline-block text-sm"
			>Home</a
		>
	{/if}
</div>
