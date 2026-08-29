<script lang="ts">
  import { query } from '$lib/api';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import FeedRow from '$lib/components/FeedRow.svelte';
  import { timeAgo } from '$lib/time';
  import type { NoteDoc, QuestionDoc, TopicDoc } from '$lib/types';

  let topic: TopicDoc | null = $state(null);
  let notes: NoteDoc[] = $state([]);
  let questions: QuestionDoc[] = $state([]);
  let loading = $state(true);

  onMount(async () => {
    const slug = page.params.slug;
    const t = await query('topics:getBySlug', { slug });
    topic = t as TopicDoc;
    if (topic) {
      const [n, q] = await Promise.all([
        query('notes:list', { topicId: topic._id }),
        query('questions:list', { topicId: topic._id })
      ]);
      notes = n as NoteDoc[];
      questions = q as QuestionDoc[];
    }
    loading = false;
  });
</script>

<svelte:head>
  <title>{topic?.name ?? 'Topic'} — Notebook</title>
</svelte:head>

<div class="page">
  {#if loading}
    <p class="kicker py-16">Loading</p>
  {:else if topic}
    <p class="kicker"><a href="/" class="hover:text-primary">Home</a> · Topic</p>
    <h1 class="mt-2 font-serif text-4xl font-medium text-ink">{topic.name}</h1>
    {#if topic.description}
      <p class="mt-2 text-[15px] text-muted">{topic.description}</p>
    {/if}

    {#if notes.length > 0}
      <p class="kicker mt-10 border-t border-rule pt-8">Notes</p>
      {#each notes as note}
        <FeedRow
          href="/notes/{note._id}"
          title={note.title}
          meta="{note.authorName} · {timeAgo(note.createdAt)} · {note.commentCount} comment{note.commentCount === 1 ? '' : 's'}"
          voteCount={note.voteCount}
          targetType="note"
          targetId={note._id}
        />
      {/each}
    {/if}

    {#if questions.length > 0}
      <p class="kicker mt-10 border-t border-rule pt-8">Questions</p>
      {#each questions as question}
        <FeedRow
          href="/questions/{question._id}"
          title={question.title}
          meta="{question.authorName} · {timeAgo(question.createdAt)} · {question.answerCount} answer{question.answerCount === 1 ? '' : 's'}"
          voteCount={question.voteCount}
          targetType="question"
          targetId={question._id}
        />
      {/each}
    {/if}

    {#if notes.length === 0 && questions.length === 0}
      <p class="mt-10 text-sm text-muted">No content in this topic yet.</p>
      <div class="mt-4 flex gap-4">
        <a href="/post/note" class="text-sm text-secondary hover:text-secondary-dark">Post a note</a>
        <a href="/post/question" class="text-sm text-secondary hover:text-secondary-dark">Ask a question</a>
      </div>
    {/if}
  {:else}
    <h1 class="font-serif text-3xl text-ink">Topic not found</h1>
    <a href="/" class="mt-2 inline-block text-sm text-secondary hover:text-secondary-dark">Home</a>
  {/if}
</div>
