<script lang="ts">
	import { query, mutation } from "$lib/api";
	import { isAuthenticated, getToken, initAuth } from "$lib/stores/auth";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
	import { postPath } from "$lib/paths";
	import type { TopicDoc, UnitDoc } from "$lib/types";

	let topics: TopicDoc[] = $state([]);
	let units: UnitDoc[] = $state([]);
	let title = $state("");
	let content = $state("");
	let selectedTopicId = $state("");
	let selectedUnitId = $state("");
	let customUnit = $state("");
	let useCustomUnit = $state(false);
	let error = $state("");
	let loading = $state(false);

	onMount(async () => {
		await initAuth();
		if (!get(isAuthenticated)) {
			goto("/auth/login", { replaceState: true });
			return;
		}
		const [t, u] = await Promise.all([query("topics:getAll"), query("units:getAll")]);
		topics = t as TopicDoc[];
		units = u as UnitDoc[];
	});

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = "";

		if (!title.trim() || !content.trim()) {
			error = "Title and content are required";
			return;
		}
		const hasUnit = useCustomUnit ? !!customUnit.trim() : !!selectedUnitId;
		if (!selectedTopicId && !hasUnit) {
			error = "Please select a topic or a unit";
			return;
		}

		const token = getToken();
		if (!token) {
			error = "You must be signed in";
			return;
		}

		loading = true;
		try {
			let unitId = useCustomUnit ? "" : selectedUnitId;
			let unitCode = units.find((unit) => unit._id === unitId)?.code ?? "";
			if (useCustomUnit && customUnit.trim()) {
				unitCode = customUnit.trim().toUpperCase();
				const existing = units.find((u) =>
					[u.code, u.code2].some((code) => code?.toUpperCase() === unitCode),
				);
				if (existing) {
					unitId = existing._id;
					unitCode = existing.code;
				} else {
					unitId = (await mutation("units:createCustom", {
						code: unitCode,
						name: unitCode,
					})) as string;
				}
			}

			const id = (await mutation("questions:create", {
				token,
				title: title.trim(),
				content: content.trim(),
				topicId: selectedTopicId,
				unitId,
			})) as string;

			goto(unitCode ? postPath(unitCode, id) : `/questions/${id}`);
		} catch (err: any) {
			error = err.message ?? "Failed to post question";
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Ask a question — Notebook</title>
</svelte:head>

<div class="page">
	<h1 class="text-ink font-serif text-4xl font-medium">Ask a question</h1>
	<p class="text-muted mt-2 mb-10 text-[15px]">
		Stuck on something? Ask the Deakin community for help.
	</p>

	<form onsubmit={handleSubmit} class="border-rule space-y-6 border-t pt-8">
		<div>
			<label for="title" class="kicker mb-2 block">Question title</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				placeholder="e.g., How does Dijkstra's algorithm handle negative edge weights?"
				class="field"
				required
			/>
		</div>

		<div>
			<MarkdownEditor
				bind:content
				label="Details"
				placeholder="Describe your question in detail..."
				rows={10}
			/>
		</div>

		<div>
			<p class="text-muted mb-3 text-xs">Choose at least one topic or unit.</p>
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
				<div>
					<label for="topic" class="kicker mb-2 block">Topic (optional)</label>
					<select id="topic" bind:value={selectedTopicId} class="field">
						<option value="">Select a topic...</option>
						{#each topics as topic}
							<option value={topic._id}>{topic.name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="unit" class="kicker mb-2 block">Unit</label>
					{#if !useCustomUnit}
						<select id="unit" bind:value={selectedUnitId} class="field">
							<option value="">Select a unit...</option>
							{#each units as unit}
								<option value={unit._id}
									>{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""} — {unit.name}</option
								>
							{/each}
						</select>
					{/if}

					<button
						type="button"
						onclick={() => {
							useCustomUnit = !useCustomUnit;
							customUnit = "";
						}}
						class="text-secondary hover:text-secondary-dark mt-2 text-xs"
					>
						{useCustomUnit ? "Choose from list" : "Other unit..."}
					</button>

					{#if useCustomUnit}
						<input
							type="text"
							bind:value={customUnit}
							placeholder="e.g., SIT384"
							class="field mt-2"
						/>
					{/if}
				</div>
			</div>
		</div>

		{#if error}
			<p class="text-primary text-sm">{error}</p>
		{/if}

		<button type="submit" disabled={loading} class="btn-primary">
			{loading ? "Posting..." : "Post question"}
		</button>
	</form>
</div>
