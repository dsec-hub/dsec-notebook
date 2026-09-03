<script lang="ts">
	import { query } from "$lib/api";
	import { unitPath } from "$lib/paths";
	import { getToken, initAuth, isAuthenticated } from "$lib/stores/auth";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import type { UnitDoc } from "$lib/types";

	let units: UnitDoc[] = $state([]);
	let pinnedUnits: UnitDoc[] = $state([]);
	let authed = $state(false);
	let loading = $state(true);
	let error = $state("");

	onMount(async () => {
		try {
			await initAuth();
			authed = get(isAuthenticated);
			const token = getToken();
			const [all, pinIds] = await Promise.all([
				query("units:getAll") as Promise<UnitDoc[]>,
				token
					? (query("units:getPinned", { token }) as Promise<UnitDoc["_id"][]>)
					: Promise.resolve([] as UnitDoc["_id"][]),
			]);
			units = all;
			const unitMap = new Map(all.map((unit) => [unit._id, unit]));
			pinnedUnits = pinIds
				.map((id) => unitMap.get(id))
				.filter((unit): unit is UnitDoc => !!unit);
		} catch (err: any) {
			error = err.message ?? "Failed to load units";
		} finally {
			loading = false;
		}
	});

	const shownUnits = $derived(authed ? pinnedUnits : units);
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
		<div class="mb-6 flex items-end justify-between gap-4">
			<p class="kicker">{authed ? "Pinned units" : "Units"}</p>
			<a href="/units" class="nav-link">All units</a>
		</div>
		{#if loading}
			<p class="kicker">Loading</p>
		{:else if error}
			<p class="kicker">{error}</p>
		{:else if authed && pinnedUnits.length === 0}
			<p class="text-muted text-sm">
				Pin units from the
				<a href="/units" class="text-secondary hover:text-secondary-dark">Units</a>
				page to keep them here.
			</p>
		{:else}
			<div class="unit-rail">
				{#each shownUnits as unit}
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
