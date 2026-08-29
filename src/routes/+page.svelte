<script lang="ts">
  import { query } from '$lib/api';
  import { onMount } from 'svelte';
  import type { UnitDoc } from '$lib/types';

  let units: UnitDoc[] = $state([]);
  let loading = $state(true);

  onMount(async () => {
    units = (await query('units:getAll')) as UnitDoc[];
    loading = false;
  });
</script>

<svelte:head>
  <title>Notebook — written by students</title>
</svelte:head>

<div class="page">
  <section class="pb-16 pt-6">
    <p class="kicker">Written by students</p>
    <h1 class="mt-4 max-w-xl font-serif text-4xl font-medium leading-[1.15] text-ink sm:text-5xl">
      One notebook for every unit, every topic.
    </h1>
    <p class="mt-5 max-w-lg text-[15px] leading-relaxed text-muted">
      Post notes in markdown, ask questions, and browse by unit. A shared notebook for Deakin students studying IT, computer science, and cybersecurity.
    </p>
    <div class="mt-8 flex flex-wrap gap-3">
      <a href="/notes" class="btn-primary">Browse notes</a>
      <a href="/questions" class="btn-secondary">Browse questions</a>
    </div>
  </section>

  <section class="border-t border-rule pt-10">
    <p class="kicker mb-6">Units</p>
    {#if loading}
      <p class="kicker">Loading</p>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2">
        {#each units as unit}
          <a
            href="/units/{unit.code}"
            class="group flex items-baseline justify-between gap-4 border-b border-rule py-3"
          >
            <span class="font-serif text-lg text-ink group-hover:text-primary">{unit.code}</span>
            <span class="truncate text-sm text-muted">{unit.name}</span>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>
