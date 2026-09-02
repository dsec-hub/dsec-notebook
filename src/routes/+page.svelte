<script lang="ts">
	import { query } from "$lib/api";
	import { unitPath } from "$lib/paths";
	import { onMount } from "svelte";
	import type { UnitDoc } from "$lib/types";

	let units: UnitDoc[] = $state([]);
	let loading = $state(true);
	let error = $state("");

	onMount(async () => {
		try {
			units = (await query("units:getAll")) as UnitDoc[];
		} catch (err: any) {
			error = err.message ?? "Failed to load units";
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>DSEC Notebook</title>
</svelte:head>

<div class="page">
	<section class="pt-6 pb-16">
		<p class="kicker">Written by students</p>
		<h1
			class="text-ink mt-4 max-w-xl font-serif text-4xl leading-[1.15] font-medium sm:text-5xl"
		>
			One notebook for every unit, every topic.
		</h1>
		<p class="text-muted mt-5 max-w-lg text-[15px] leading-relaxed">
			Post notes in markdown, ask questions, and browse by unit. A shared notebook for Deakin
			students studying IT, computer science, and cybersecurity.
		</p>
		<div class="mt-8 flex flex-wrap gap-3">
			<a href="/notes" class="btn-primary">Browse notes</a>
			<a href="/questions" class="btn-secondary">Browse questions</a>
		</div>
	</section>

	<section class="border-rule border-t pt-10">
		<p class="kicker mb-6">Units</p>
		{#if loading}
			<p class="kicker">Loading</p>
		{:else if error}
			<p class="kicker">{error}</p>
		{:else}
			<div class="unit-rail">
				{#each units as unit}
					<a href={unitPath(unit.code)} class="unit-card group flex flex-col gap-1">
						<span
							class="text-ink group-hover:text-primary font-serif text-base leading-tight"
							>{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}</span
						>
						<span class="text-muted line-clamp-2 text-xs leading-snug">{unit.name}</span
						>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>
