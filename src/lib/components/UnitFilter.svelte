<script lang="ts">
	import { onMount } from "svelte";
	import { query, mutation } from "$lib/api";
	import { getToken, isAuthenticated, initAuth } from "$lib/stores/auth";
	import { get } from "svelte/store";
	import type { UnitDoc } from "$lib/types";

	const MAX_PINS = 10;

	let {
		units,
		selectedUnitId = $bindable(""),
	}: {
		units: UnitDoc[];
		selectedUnitId?: string;
	} = $props();

	let pinnedIds = $state<string[]>([]);
	let authed = $state(false);
	let busy = $state(false);
	let error = $state("");

	onMount(async () => {
		await initAuth();
		if (!get(isAuthenticated)) return;
		authed = true;
		const token = getToken();
		if (!token) return;
		try {
			pinnedIds = (await query("units:getPinned", { token })) as string[];
		} catch {
			// ignore
		}
	});

	const pinnedUnits = $derived(
		pinnedIds.map((id) => units.find((u) => u._id === id)).filter((u): u is UnitDoc => !!u),
	);

	const otherUnits = $derived(units.filter((u) => !pinnedIds.includes(u._id)));

	const canPinMore = $derived(pinnedIds.length < MAX_PINS);

	async function togglePin(unit: UnitDoc) {
		const token = getToken();
		if (!token) {
			error = "Sign in to pin units";
			return;
		}

		busy = true;
		error = "";
		try {
			const pinned = pinnedIds.includes(unit._id);
			pinnedIds = (await mutation(pinned ? "units:unpin" : "units:pin", {
				token,
				unitId: unit._id,
			})) as string[];
		} catch (err: any) {
			error = err?.message ?? "Failed to update pin";
		} finally {
			busy = false;
		}
	}
</script>

{#snippet pinIcon()}
	<svg
		width="14"
		height="14"
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
{/snippet}

<div class="flex items-center gap-x-1 gap-y-2 overflow-x-scroll scrollbar-thin pb-2">
	<button
		type="button"
		class="chip {selectedUnitId === '' ? 'chip-active' : ''}"
		onclick={() => (selectedUnitId = "")}
	>
		All units
	</button>

	{#each pinnedUnits as unit (unit._id)}
		<span class="inline-flex items-center">
			<button
				type="button"
				class="chip {selectedUnitId === unit._id ? 'chip-active' : ''}"
				onclick={() => (selectedUnitId = unit._id)}
			>
				{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}
			</button>
			<button
				type="button"
				class="pin-btn pin-btn-active"
				onclick={() => togglePin(unit)}
				disabled={busy}
				title="Unpin unit"
				aria-label="Unpin unit"
			>
				{@render pinIcon()}
			</button>
		</span>
	{/each}

	{#each otherUnits as unit (unit._id)}
		<span class="inline-flex items-center">
			<button
				type="button"
				class="chip {selectedUnitId === unit._id ? 'chip-active' : ''}"
				onclick={() => (selectedUnitId = unit._id)}
			>
				{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}
			</button>
			{#if authed}
				<button
					type="button"
					class="pin-btn"
					onclick={() => togglePin(unit)}
					disabled={busy || !canPinMore}
					title={canPinMore ? "Pin unit" : "You can pin up to 10 units"}
					aria-label={canPinMore ? "Pin unit" : "You can pin up to 10 units"}
				>
					{@render pinIcon()}
				</button>
			{/if}
		</span>
	{/each}

	{#if error}
		<span class="text-primary text-xs">{error}</span>
	{/if}
</div>
