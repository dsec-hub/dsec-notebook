<script lang="ts">
	import Navbar from "$lib/components/Navbar.svelte";
	import { initAuth } from "$lib/stores/auth";
	import { onMount } from "svelte";
	import "./layout.css";

	let { children } = $props();

	onMount(() => {
		initAuth();
	});

	onMount(async () => {
		const { registerSW } = await import("virtual:pwa-register");
		registerSW({
			immediate: true,
			onRegisterError(error) {
				console.error("Service worker registration failed", error);
			},
		});
	});
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="bg-surface flex min-h-screen flex-col">
	<Navbar />
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="border-rule mt-16 border-t">
		<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6">
			<p class="kicker">DSEC Notebook</p>
			<p class="text-faint mt-2 text-xs">
				DSEC Notebook is a community resource for Deakin University students. Not affiliated
				with Deakin University.
			</p>
		</div>
	</footer>
</div>
