<script lang="ts">
	import { query } from "$lib/api";
	import { unitPath } from "$lib/paths";
	import { unitMatchesQuery } from "$lib/search";
	import { onMount } from "svelte";
	import type { UnitDoc } from "$lib/types";

	let units: UnitDoc[] = $state([]);
	let loading = $state(true);
	let searchQuery = $state("");

	onMount(async () => {
		try {
			units = (await query("units:getAll")) as UnitDoc[];
		} finally {
			loading = false;
		}
	});

	const visible = $derived(units.filter((unit) => unitMatchesQuery(unit, searchQuery)));
</script>

<svelte:head>
	<title>Units — DSEC Notebook</title>
</svelte:head>

<div class="page">
	<div class="border-rule border-b pb-6">
		<h1 class="text-ink font-serif text-4xl font-medium">Units</h1>
		<p class="text-muted mt-2 text-sm">
			Browse notes and questions by unit. Pin the units you are studying to keep them handy.
		</p>
	</div>

	<div class="border-rule border-b py-4">
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Search units..."
			aria-label="Search units"
			class="field"
		/>
	</div>

	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if units.length === 0}
		<p class="text-muted py-16 text-sm">No units yet.</p>
	{:else if visible.length === 0}
		<p class="text-muted py-16 text-sm">
			No units match “{searchQuery.trim()}”.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each visible as unit (unit._id)}
				<a href={unitPath(unit.code)} class="unit-card flex h-full w-full flex-col gap-2">
					<span class="text-ink font-serif text-base leading-tight"
						>{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}</span
					>
					<span class="text-ink text-sm leading-snug">{unit.name}</span>
					{#if unit.description}
						<p class="text-muted line-clamp-3 text-xs leading-snug">
							{unit.description}
						</p>
					{/if}
				</a>
			{/each}
		</div>
	{/if}
</div>
