<script lang="ts">
	import { query, mutation } from "$lib/api";
	import { isAuthenticated, getToken, currentUser } from "$lib/stores/auth";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import VoteStack from "$lib/components/VoteStack.svelte";
	import { timeAgo } from "$lib/time";
	import type { QuestionDoc, CommentDoc, TopicDoc, UnitDoc } from "$lib/types";

	let question: QuestionDoc | null = $state(null);
	let topic: TopicDoc | null = $state(null);
	let unit: UnitDoc | null = $state(null);
	let answers: CommentDoc[] = $state([]);
	let loading = $state(true);
	let isAuthor = $state(false);

	let answerText = $state("");
	let answerError = $state("");
	let answerLoading = $state(false);

	onMount(async () => {
		const id = page.params.id;
		const result = await query("details:getQuestionWithDetails", { id });
		if (result) {
			question = result as QuestionDoc;
			topic = (result as any).topic ?? null;
			unit = (result as any).unit ?? null;
			answers = (result as any).answers ?? [];
			const cu = get(currentUser);
			if (cu) isAuthor = question.authorId === cu._id;
		}
		loading = false;
	});

	async function postAnswer() {
		if (!answerText.trim()) return;
		const token = getToken();
		if (!token) {
			answerError = "Please sign in to answer";
			return;
		}

		answerLoading = true;
		answerError = "";
		try {
			await mutation("comments:createOnQuestion", {
				token,
				content: answerText.trim(),
				questionId: page.params.id,
			});
			answerText = "";
			const updated = await query("details:getQuestionWithDetails", { id: page.params.id });
			if (updated) {
				question = { ...(updated as any), answers: undefined } as QuestionDoc;
				answers = (updated as any).answers ?? [];
			}
		} catch (err: any) {
			answerError = err.message ?? "Failed to post answer";
		} finally {
			answerLoading = false;
		}
	}

	async function markSolved() {
		const token = getToken();
		if (!token || !question) return;
		try {
			await mutation("questions:markSolved", { token, id: question._id });
			question = { ...question, solved: true };
		} catch (err: any) {
			alert(err.message ?? "Failed");
		}
	}
</script>

<svelte:head>
	<title>{question?.title ?? "Loading..."} — Notebook</title>
</svelte:head>

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if question}
		<div class="flex gap-5">
			<VoteStack count={question.voteCount} targetType="question" targetId={question._id} />
			<div class="min-w-0 flex-1">
				<p class="kicker">
					{#if unit}{unit.code}{/if}{#if unit && topic}
						·
					{/if}{#if topic}{topic.name}{/if}
					{#if question.solved}
						· Solved{/if}
				</p>
				<h1 class="text-ink mt-2 font-serif text-3xl leading-tight font-medium sm:text-4xl">
					{question.title}
				</h1>
				<p class="kicker mt-3">
					{question.authorName} · {timeAgo(question.createdAt)}
					{#if isAuthor && !question.solved}
						·
						<button
							type="button"
							onclick={markSolved}
							class="text-secondary hover:text-secondary-dark"
						>
							Mark as solved
						</button>
					{/if}
				</p>
			</div>
		</div>

		<div
			class="border-rule text-ink mt-8 border-t pt-8 text-[15px] leading-relaxed whitespace-pre-wrap"
		>
			{question.content}
		</div>

		<section class="border-rule mt-12 border-t pt-8">
			<p class="kicker mb-6">Answers ({answers.length})</p>

			{#if get(isAuthenticated)}
				<div class="mb-8">
					<textarea
						bind:value={answerText}
						rows={4}
						placeholder="Write an answer..."
						class="field resize-y"></textarea>
					<div class="mt-3 flex items-center justify-between">
						<span class="text-primary text-xs">{answerError}</span>
						<button
							onclick={postAnswer}
							disabled={answerLoading || !answerText.trim()}
							class="btn-primary"
						>
							{answerLoading ? "Posting..." : "Post answer"}
						</button>
					</div>
				</div>
			{:else}
				<p class="text-muted mb-8 text-sm">
					<a href="/auth/login" class="text-secondary hover:text-secondary-dark"
						>Sign in</a
					> to answer.
				</p>
			{/if}

			<div>
				{#each answers as answer}
					<div class="border-rule border-t py-4">
						<p class="kicker">{answer.authorName} · {timeAgo(answer.createdAt)}</p>
						<p class="text-ink mt-2 text-sm leading-relaxed whitespace-pre-wrap">
							{answer.content}
						</p>
						{#if get(currentUser)?._id === answer.authorId}
							<button
								onclick={async () => {
									const token = getToken();
									if (!token) return;
									try {
										await mutation("comments:remove", {
											token,
											id: answer._id,
										});
										const updated = await query(
											"details:getQuestionWithDetails",
											{ id: page.params.id },
										);
										if (updated) answers = (updated as any).answers ?? [];
									} catch (e) {}
								}}
								class="text-primary hover:text-primary-dark mt-2 text-xs"
								>Delete</button
							>
						{/if}
					</div>
				{:else}
					<p class="text-muted text-sm">No answers yet.</p>
				{/each}
			</div>
		</section>
	{:else}
		<h1 class="text-ink font-serif text-3xl">Question not found</h1>
		<p class="text-muted mt-2 text-sm">This question may have been deleted or doesn't exist.</p>
		<a
			href="/questions"
			class="text-secondary hover:text-secondary-dark mt-4 inline-block text-sm"
			>Back to questions</a
		>
	{/if}
</div>
