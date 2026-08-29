<script lang="ts">
  import { query } from '$lib/api';
  import { onMount } from 'svelte';
  import FeedRow from '$lib/components/FeedRow.svelte';
  import { timeAgo } from '$lib/time';
  import type { NoteDoc } from '$lib/types';

  let results: NoteDoc[] = $state([]);
  let loading = $state(true);
  let searchQuery = $state('');
  let ranQuery = $state(false);

  onMount(async () => {
    searchQuery = new URL(window.location.href).searchParams.get('q') ?? '';
    if (searchQuery) {
      ranQuery = true;
      results = (await query('notes:search', { query: searchQuery })) as NoteDoc[];
    }
    loading = false;
  });
</script>

<svelte:head>
  <title>{searchQuery ? `Search: ${searchQuery}` : 'Search'} — Notebook</title>
</svelte:head>

<div class="page">
  <h1 class="font-serif text-4xl font-medium text-ink">Search</h1>
  <form
    class="mt-6 mb-8 border-b border-rule pb-8"
    onsubmit={(e) => {
      e.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      window.location.href = `/search?q=${encodeURIComponent(q)}`;
    }}
  >
    <label for="q" class="kicker mb-2 block">Query</label>
    <input id="q" type="search" bind:value={searchQuery} placeholder="Search notes..." class="field" />
  </form>

  {#if loading}
    <p class="kicker py-16">Loading</p>
  {:else if ranQuery}
    {#each results as note}
      <FeedRow
        href="/notes/{note._id}"
        title={note.title}
        meta="{note.authorName} · {timeAgo(note.createdAt)}"
        voteCount={note.voteCount}
        targetType="note"
        targetId={note._id}
      />
    {:else}
      <p class="text-sm text-muted">No results found for “{searchQuery}”.</p>
      <a href="/notes" class="mt-4 inline-block text-sm text-secondary hover:text-secondary-dark">Browse notes</a>
    {/each}
  {/if}
</div>
