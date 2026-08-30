<script lang="ts">
	import Navbar from "$lib/components/Navbar.svelte";
	import { initAuth } from "$lib/stores/auth";
	import { onMount } from "svelte";
	import "./layout.css";

	let { children } = $props();

	onMount(() => {
		initAuth();
	});
</script>

<svelte:head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="icon" href="/favicon.svg" />
</svelte:head>

<div class="flex min-h-screen flex-col bg-white">
	<Navbar />
	<main class="flex-1">
		{@render children()}
	</main>
	<footer class="border-rule mt-16 border-t">
		<div
			class="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-6"
		>
			<div>
				<p class="kicker">Notebook — written by students, for students.</p>
				<p class="text-faint mt-2 text-xs">
					DSEC Notebook is a community resource for Deakin University students. Not
					affiliated with Deakin University.
				</p>
			</div>
			<a href="/search" class="kicker hover:text-primary">Search</a>
		</div>
	</footer>
</div>
