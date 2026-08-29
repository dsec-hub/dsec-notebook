<script lang="ts">
  import { query } from '$lib/api';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import FeedRow from '$lib/components/FeedRow.svelte';
  import { timeAgo } from '$lib/time';
  import type { NoteDoc, QuestionDoc, UnitDoc } from '$lib/types';

  let unit: UnitDoc | null = $state(null);
  let notes: NoteDoc[] = $state([]);
  let questions: QuestionDoc[] = $state([]);
  let loading = $state(true);

  onMount(async () => {
    const code = page.params.code;
    const u = await query('units:getByCode', { code });
    unit = u as UnitDoc;
    if (unit) {
      const [n, q] = await Promise.all([
        query('notes:list', { unitId: unit._id }),
        query('questions:list', { unitId: unit._id })
      ]);
      notes = n as NoteDoc[];
      questions = q as QuestionDoc[];
    }
    loading = false;
  });
</script>

<svelte:head>
  <title>{unit?.code ?? 'Unit'} — Notebook</title>
</svelte:head>

<div class="page">
  {#if loading}
    <p class="kicker py-16">Loading</p>
  {:else if unit}
    <p class="kicker"><a href="/" class="hover:text-primary">Home</a> · Unit</p>
    <h1 class="mt-2 font-serif text-4xl font-medium text-ink">{unit.code}</h1>
    <p class="mt-1 text-[15px] text-muted">{unit.name}</p>
    {#if unit.description}
      <p class="mt-2 text-sm text-muted">{unit.description}</p>
    {/if}

    {#if notes.length > 0}
      <p class="kicker mt-10 border-t border-rule pt-8">Notes</p>
      {#each notes as note}
        <FeedRow
          href="/notes/{note._id}"
          title={note.title}
          unitCode={unit.code}
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
          unitCode={unit.code}
          meta="{question.authorName} · {timeAgo(question.createdAt)} · {question.answerCount} answer{question.answerCount === 1 ? '' : 's'}"
          voteCount={question.voteCount}
          targetType="question"
          targetId={question._id}
        />
      {/each}
    {/if}

    {#if notes.length === 0 && questions.length === 0}
      <p class="mt-10 text-sm text-muted">No content for this unit yet.</p>
      <div class="mt-4 flex gap-4">
        <a href="/post/note" class="text-sm text-secondary hover:text-secondary-dark">Post a note</a>
        <a href="/post/question" class="text-sm text-secondary hover:text-secondary-dark">Ask a question</a>
      </div>
    {/if}
  {:else}
    <h1 class="font-serif text-3xl text-ink">Unit not found</h1>
    <a href="/" class="mt-2 inline-block text-sm text-secondary hover:text-secondary-dark">Home</a>
  {/if}
</div>
