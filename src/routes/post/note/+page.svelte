<script lang="ts">
	import { query, mutation } from "$lib/api";
	import { isAuthenticated, getToken, initAuth } from "$lib/stores/auth";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
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
	let success = $state("");

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
		success = "";

		if (!title.trim() || !content.trim()) {
			error = "Title and content are required";
			return;
		}
		if (!selectedTopicId) {
			error = "Please select a topic";
			return;
		}

		const token = getToken();
		if (!token) {
			error = "You must be signed in";
			return;
		}

		loading = true;
		try {
			let unitId = selectedUnitId;
			if (useCustomUnit && customUnit.trim()) {
				const existing = units.find(
					(u) => u.code.toLowerCase() === customUnit.trim().toUpperCase(),
				);
				if (existing) {
					unitId = existing._id;
				} else {
					unitId = (await mutation("units:createCustom", {
						code: customUnit.trim().toUpperCase(),
						name: customUnit.trim().toUpperCase(),
					})) as string;
				}
			}

			await mutation("notes:create", {
				token,
				title: title.trim(),
				content: content.trim(),
				topicId: selectedTopicId,
				unitId,
			});

			success = "Note published.";
			title = "";
			content = "";
			selectedTopicId = "";
			selectedUnitId = "";
			customUnit = "";
			useCustomUnit = false;

			setTimeout(() => {
				success = "";
			}, 3000);
		} catch (err: any) {
			error = err.message ?? "Failed to publish note";
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Post a note — Notebook</title>
</svelte:head>

<div class="page">
	<h1 class="text-ink font-serif text-4xl font-medium">Post a note</h1>
	<p class="text-muted mt-2 mb-10 text-[15px]">
		Share study notes with the Deakin community. Focus on a specific topic, not an entire unit.
	</p>

	{#if success}
		<p class="text-secondary mb-6 text-sm">{success}</p>
	{/if}

	<form onsubmit={handleSubmit} class="border-rule space-y-6 border-t pt-8">
		<div>
			<label for="title" class="kicker mb-2 block">Title</label>
			<input
				id="title"
				type="text"
				bind:value={title}
				placeholder="e.g., Binary Search Tree Implementation in Python"
				class="field"
				required
			/>
		</div>

		<div>
			<label for="content" class="kicker mb-2 block">Content</label>
			<textarea
				id="content"
				bind:value={content}
				rows={10}
				placeholder="Write your notes here..."
				class="field resize-y"
				required></textarea>
		</div>

		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
			<div>
				<label for="topic" class="kicker mb-2 block">Topic</label>
				<select id="topic" bind:value={selectedTopicId} class="field" required>
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

		{#if error}
			<p class="text-primary text-sm">{error}</p>
		{/if}

		<button type="submit" disabled={loading} class="btn-primary">
			{loading ? "Publishing..." : "Publish note"}
		</button>
	</form>
</div>
