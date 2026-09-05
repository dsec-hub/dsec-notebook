<script lang="ts">
	import { query, mutation } from "$lib/api";
	import { isAuthenticated, getToken, currentUser } from "$lib/stores/auth";
	import { page } from "$app/state";
	import { get } from "svelte/store";
	import VoteStack from "$lib/components/VoteStack.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
	import CommentThread from "$lib/components/CommentThread.svelte";
	import Seo from "$lib/components/Seo.svelte";
	import { postSeo } from "$lib/seo";
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

	let editMode = $state(false);
	let editTitle = $state("");
	let editContent = $state("");
	let editError = $state("");
	let editLoading = $state(false);

	const seo = $derived.by(() => (question ? postSeo({ ...question, unit }) : page.data.seo));

	$effect(() => {
		const id = page.params.id;
		let cancelled = false;
		loading = true;
		question = null;
		editMode = false;
		answerText = "";
		answerError = "";
		isAuthor = false;

		void (async () => {
			const result = await query("details:getQuestionWithDetails", { id });
			if (cancelled) return;
			if (result) {
				question = result as QuestionDoc;
				topic = (result as any).topic ?? null;
				unit = (result as any).unit ?? null;
				answers = (result as any).answers ?? [];
				const cu = get(currentUser);
				if (cu) isAuthor = question.authorId === cu._id;
			}
			loading = false;
		})();

		return () => {
			cancelled = true;
		};
	});

	async function reloadAnswers() {
		const updated = await query("details:getQuestionWithDetails", { id: page.params.id });
		if (updated) answers = (updated as any).answers ?? [];
	}

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
			await reloadAnswers();
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

	function startEdit() {
		if (!question) return;
		editTitle = question.title;
		editContent = question.content;
		editError = "";
		editMode = true;
	}

	function cancelEdit() {
		editMode = false;
		editError = "";
	}

	async function saveEdit() {
		if (!question) return;
		if (!editTitle.trim() || !editContent.trim()) {
			editError = "Title and content are required";
			return;
		}
		const token = getToken();
		if (!token) {
			editError = "You must be signed in";
			return;
		}

		editLoading = true;
		editError = "";
		try {
			await mutation("questions:update", {
				token,
				id: question._id,
				title: editTitle.trim(),
				content: editContent.trim(),
			});
			const updated = await query("details:getQuestionWithDetails", { id: question._id });
			if (updated) {
				question = { ...(updated as any), answers: undefined } as QuestionDoc;
				topic = (updated as any).topic ?? null;
				unit = (updated as any).unit ?? null;
				answers = (updated as any).answers ?? [];
			}
			editMode = false;
		} catch (err: any) {
			editError = err.message ?? "Failed to save";
		} finally {
			editLoading = false;
		}
	}
</script>

<Seo {seo} />

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if question}
		<div class="flex gap-5">
			<VoteStack count={question.voteCount} targetType="question" targetId={question._id} />
			<div class="min-w-0 flex-1">
				<p class="kicker">
					{#if unit}{unit.code}{unit.code2
							? ` / ${unit.code2}`
							: ""}{/if}{#if unit && topic}
						·
					{/if}{#if topic}{topic.name}{/if}
					{#if question.solved}
						· Solved{/if}
				</p>
				{#if editMode}
					<input
						type="text"
						bind:value={editTitle}
						placeholder="Question title"
						class="field mt-2"
					/>
				{:else}
					<h1
						class="text-ink mt-2 font-serif text-3xl leading-tight font-medium sm:text-4xl"
					>
						{question.title}
					</h1>
					{#if question.updatedAt > question.createdAt}
						<p class="kicker mt-2">Edited</p>
					{/if}
				{/if}
				{#if !editMode}
					<p class="kicker mt-3">
						<a href={`/users/${question.authorId}`} class="hover:text-primary"
							>{question.authorName}</a
						>
						· {timeAgo(question.createdAt)}
						{#if isAuthor}
							·
							<button
								type="button"
								onclick={startEdit}
								class="text-secondary hover:text-secondary-dark"
							>
								Edit
							</button>
							{#if !question.solved}
								·
								<button
									type="button"
									onclick={markSolved}
									class="text-secondary hover:text-secondary-dark"
								>
									Mark as solved
								</button>
							{/if}
						{/if}
					</p>
				{/if}
			</div>
		</div>

		{#if editMode}
			<div class="mt-8">
				<MarkdownEditor bind:content={editContent} label="Details" rows={12} />
				<div class="mt-4 flex items-center gap-3">
					<button
						type="button"
						onclick={saveEdit}
						disabled={editLoading}
						class="btn-primary"
					>
						{editLoading ? "Saving..." : "Save changes"}
					</button>
					<button type="button" onclick={cancelEdit} class="kicker hover:text-ink">
						Cancel
					</button>
					<span class="text-primary text-xs">{editError}</span>
				</div>
			</div>
		{:else}
			<div class="border-rule text-ink mt-8 border-t pt-8 text-[15px] leading-relaxed">
				<Markdown content={question.content} />
			</div>
		{/if}

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
				<CommentThread
					comments={answers}
					targetType="question"
					targetId={question._id}
					reload={reloadAnswers}
				/>
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
