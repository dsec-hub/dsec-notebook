<script lang="ts">
	import { goto } from "$app/navigation";
	import { initAuth, isAuthenticated } from "$lib/stores/auth";
	import { onMount } from "svelte";
	import { get } from "svelte/store";

	let { children } = $props();
	let ready = $state(false);

	onMount(() => {
		let cancelled = false;

		(async () => {
			await initAuth();
			if (cancelled) return;
			if (get(isAuthenticated)) {
				await goto("/account", { replaceState: true });
				return;
			}
			ready = true;
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

{#if ready}
	{@render children()}
{:else}
	<div class="page">
		<p class="kicker py-16">Loading</p>
	</div>
{/if}
