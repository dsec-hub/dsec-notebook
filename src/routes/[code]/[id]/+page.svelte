<script lang="ts">
	import { page } from "$app/state";
	import { query } from "$lib/api";
	import NotePage from "../../notes/[id]/+page.svelte";
	import QuestionPage from "../../questions/[id]/+page.svelte";

	let postType: "note" | "question" | null = $state(null);
	let loading = $state(true);

	$effect(() => {
		const id = page.params.id;
		const requestedCode = (page.params.code ?? "").toLowerCase();
		let cancelled = false;
		postType = null;
		loading = true;

		void (async () => {
			const note = await query("details:getNoteWithDetails", { id });
			const result = note ?? (await query("details:getQuestionWithDetails", { id }));
			if (cancelled) return;
			const unit = result?.unit;
			if (
				result &&
				unit &&
				[unit.code, unit.code2].some((code) => code?.toLowerCase() === requestedCode)
			) {
				postType = note ? "note" : "question";
			}
			loading = false;
		})();

		return () => {
			cancelled = true;
		};
	});
</script>

{#if loading}
	<div class="page">
		<p class="kicker py-16">Loading</p>
	</div>
{:else if postType === "note"}
	{#key page.params.id}
		<NotePage />
	{/key}
{:else if postType === "question"}
	{#key page.params.id}
		<QuestionPage />
	{/key}
{:else}
	<div class="page">
		<h1 class="text-ink font-serif text-3xl">Post not found</h1>
		<a href="/" class="text-secondary hover:text-secondary-dark mt-2 inline-block text-sm"
			>Home</a
		>
	</div>
{/if}
