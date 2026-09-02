<script lang="ts">
	import { page } from "$app/state";
	import { query } from "$lib/api";
	import { onMount } from "svelte";
	import NotePage from "../../notes/[id]/+page.svelte";
	import QuestionPage from "../../questions/[id]/+page.svelte";

	let postType: "note" | "question" | null = $state(null);
	let loading = $state(true);

	onMount(async () => {
		const note = await query("details:getNoteWithDetails", { id: page.params.id });
		const result =
			note ?? (await query("details:getQuestionWithDetails", { id: page.params.id }));
		const unit = result?.unit;
		const requestedCode = (page.params.code ?? "").toLowerCase();

		if (
			result &&
			unit &&
			[unit.code, unit.code2].some((code) => code?.toLowerCase() === requestedCode)
		) {
			postType = note ? "note" : "question";
		}
		loading = false;
	});
</script>

{#if loading}
	<div class="page">
		<p class="kicker py-16">Loading</p>
	</div>
{:else if postType === "note"}
	<NotePage />
{:else if postType === "question"}
	<QuestionPage />
{:else}
	<div class="page">
		<h1 class="text-ink font-serif text-3xl">Post not found</h1>
		<a href="/" class="text-secondary hover:text-secondary-dark mt-2 inline-block text-sm"
			>Home</a
		>
	</div>
{/if}
