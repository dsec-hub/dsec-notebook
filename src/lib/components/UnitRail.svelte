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

	const isPinned = (id: string) => pinnedIds.includes(id);
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

<div class="unit-rail">
	{#each units as unit (unit._id)}
		<div class="unit-card {selectedUnitId === unit._id ? 'unit-card-active' : ''}">
			<button
				type="button"
				class="flex h-full w-full flex-col items-start gap-1 text-left"
				onclick={() => (selectedUnitId = unit._id)}
				aria-label="Select {unit.code}"
			>
				<span class="text-ink font-serif text-base leading-tight"
					>{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}</span
				>
				<span class="text-muted line-clamp-2 text-xs leading-snug">{unit.name}</span>
			</button>
			{#if authed}
				<button
					type="button"
					class="pin-btn {isPinned(unit._id)
						? 'pin-btn-active'
						: ''} absolute top-1.5 right-1.5 z-10"
					onclick={() => togglePin(unit)}
					disabled={busy || (!isPinned(unit._id) && !canPinMore)}
					title={isPinned(unit._id)
						? "Unpin unit"
						: canPinMore
							? "Pin unit"
							: "You can pin up to 10 units"}
					aria-label={isPinned(unit._id) ? "Unpin unit" : "Pin unit"}
				>
					{@render pinIcon()}
				</button>
			{/if}
		</div>
	{/each}
</div>

{#if error}
	<p class="text-primary mt-2 text-xs">{error}</p>
{/if}
