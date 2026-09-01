<script lang="ts">
	import { query, mutation } from "$lib/api";
	import { getToken } from "$lib/stores/auth";
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";

	let {
		count = 0,
		targetType,
		targetId,
	}: {
		count?: number;
		targetType: "note" | "question";
		targetId: string;
	} = $props();

	let localCount = $state<number | null>(null);
	let userVote = $state(0);
	let busy = $state(false);
	const voteCount = $derived(localCount ?? count);

	onMount(async () => {
		const token = getToken();
		if (!token) return;
		try {
			userVote = (await query("votes:getMyVote", { token, targetType, targetId })) ?? 0;
		} catch {
			/* ignore */
		}
	});

	async function vote(value: 1 | -1, e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const token = getToken();
		if (!token) {
			goto("/auth/login");
			return;
		}
		if (busy) return;
		busy = true;
		try {
			const result = await mutation("votes:cast", { token, targetType, targetId, value });
			localCount = result.voteCount;
			userVote = result.userVote;
		} catch {
			/* ignore */
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex w-8 shrink-0 flex-col gap-1">
	<button
		type="button"
		class="border-rule text-muted hover:border-secondary hover:text-secondary flex h-8 w-8 items-center justify-center border transition-colors {userVote ===
		1
			? 'border-primary text-primary'
			: ''}"
		onclick={(e) => vote(1, e)}
		aria-label="Upvote"
		disabled={busy}
	>
		<svg
			class="h-3.5 w-3.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
		>
			<path d="M6 15l6-6 6 6" stroke-linecap="square" />
		</svg>
	</button>
	<div
		class="border-rule text-ink flex h-8 w-8 items-center justify-center border font-sans text-xs"
	>
		{voteCount}
	</div>
	<button
		type="button"
		class="border-rule text-muted hover:border-secondary hover:text-secondary flex h-8 w-8 items-center justify-center border transition-colors {userVote ===
		-1
			? 'border-primary text-primary'
			: ''}"
		onclick={(e) => vote(-1, e)}
		aria-label="Downvote"
		disabled={busy}
	>
		<svg
			class="h-3.5 w-3.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
		>
			<path d="M6 9l6 6 6-6" stroke-linecap="square" />
		</svg>
	</button>
</div>
