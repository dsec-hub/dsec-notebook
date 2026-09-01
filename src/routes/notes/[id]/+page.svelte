<script lang="ts">
	import { query, mutation } from "$lib/api";
	import { isAuthenticated, getToken, currentUser } from "$lib/stores/auth";
	import { page } from "$app/state";
	import { onMount } from "svelte";
	import { get } from "svelte/store";
	import VoteStack from "$lib/components/VoteStack.svelte";
	import Markdown from "$lib/components/Markdown.svelte";
	import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
	import { timeAgo } from "$lib/time";
	import type { NoteDoc, CommentDoc, TopicDoc, UnitDoc } from "$lib/types";

	let note: NoteDoc | null = $state(null);
	let topic: TopicDoc | null = $state(null);
	let unit: UnitDoc | null = $state(null);
	let comments: CommentDoc[] = $state([]);
	let loading = $state(true);

	let commentText = $state("");
	let commentError = $state("");
	let commentLoading = $state(false);
	let deleteLoading = $state(false);
	let isAuthor = $state(false);

	let editMode = $state(false);
	let editTitle = $state("");
	let editContent = $state("");
	let editError = $state("");
	let editLoading = $state(false);

	onMount(async () => {
		const id = page.params.id;
		const result = await query("details:getNoteWithDetails", { id });
		if (result) {
			note = result as NoteDoc;
			topic = (result as any).topic ?? null;
			unit = (result as any).unit ?? null;
			comments = (result as any).comments ?? [];
			const cu = get(currentUser);
			if (cu) isAuthor = note.authorId === cu._id;
		}
		loading = false;
	});

	async function postComment() {
		if (!commentText.trim()) return;
		const token = getToken();
		if (!token) {
			commentError = "Please sign in to comment";
			return;
		}

		commentLoading = true;
		commentError = "";
		try {
			await mutation("comments:createOnNote", {
				token,
				content: commentText.trim(),
				parentId: page.params.id,
			});
			commentText = "";
			const updated = await query("details:getNoteWithDetails", { id: page.params.id });
			if (updated) comments = (updated as any).comments ?? [];
		} catch (err: any) {
			commentError = err.message ?? "Failed to post comment";
		} finally {
			commentLoading = false;
		}
	}

	async function deleteNote() {
		const token = getToken();
		if (!token || !note) return;
		if (!confirm("Delete this note?")) return;

		deleteLoading = true;
		try {
			await mutation("notes:remove", { token, id: note._id });
			window.location.href = "/notes";
		} catch (err: any) {
			alert(err.message ?? "Failed to delete");
		} finally {
			deleteLoading = false;
		}
	}

	function startEdit() {
		if (!note) return;
		editTitle = note.title;
		editContent = note.content;
		editError = "";
		editMode = true;
	}

	function cancelEdit() {
		editMode = false;
		editError = "";
	}

	async function saveEdit() {
		if (!note) return;
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
			await mutation("notes:update", {
				token,
				id: note._id,
				title: editTitle.trim(),
				content: editContent.trim(),
			});
			const updated = await query("details:getNoteWithDetails", { id: note._id });
			if (updated) {
				note = updated as NoteDoc;
				topic = (updated as any).topic ?? null;
				unit = (updated as any).unit ?? null;
				comments = (updated as any).comments ?? [];
			}
			editMode = false;
		} catch (err: any) {
			editError = err.message ?? "Failed to save";
		} finally {
			editLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{note?.title ?? "Loading..."} — Notebook</title>
</svelte:head>

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if note}
		<div class="flex gap-5">
			<VoteStack count={note.voteCount} targetType="note" targetId={note._id} />
			<div class="min-w-0 flex-1">
				<p class="kicker">
					{#if unit}{unit.code}{unit.code2
							? ` / ${unit.code2}`
							: ""}{/if}{#if unit && topic}
						·
					{/if}{#if topic}{topic.name}{/if}
				</p>
				{#if editMode}
					<input
						type="text"
						bind:value={editTitle}
						placeholder="Note title"
						class="field mt-2"
					/>
				{:else}
					<h1
						class="text-ink mt-2 font-serif text-3xl leading-tight font-medium sm:text-4xl"
					>
						{note.title}
					</h1>
					{#if note.updatedAt > note.createdAt}
						<p class="kicker mt-2">Edited</p>
					{/if}
				{/if}
				{#if !editMode}
					<p class="kicker mt-3">
						{note.authorName} · {timeAgo(note.createdAt)}
						{#if isAuthor}
							·
							<button
								type="button"
								onclick={startEdit}
								class="text-secondary hover:text-secondary-dark"
							>
								Edit
							</button>
							·
							<button
								type="button"
								onclick={deleteNote}
								disabled={deleteLoading}
								class="text-primary hover:text-primary-dark"
							>
								{deleteLoading ? "Deleting..." : "Delete"}
							</button>
						{/if}
					</p>
				{/if}
			</div>
		</div>

		{#if editMode}
			<div class="mt-8">
				<MarkdownEditor bind:content={editContent} label="Content" rows={12} />
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
				<Markdown content={note.content} />
			</div>
		{/if}

		<section class="border-rule mt-12 border-t pt-8">
			<p class="kicker mb-6">Comments ({comments.length})</p>

			{#if get(isAuthenticated)}
				<div class="mb-8">
					<textarea
						bind:value={commentText}
						rows={3}
						placeholder="Add a comment..."
						class="field resize-y"></textarea>
					<div class="mt-3 flex items-center justify-between">
						<span class="text-primary text-xs">{commentError}</span>
						<button
							onclick={postComment}
							disabled={commentLoading || !commentText.trim()}
							class="btn-primary"
						>
							{commentLoading ? "Posting..." : "Post comment"}
						</button>
					</div>
				</div>
			{:else}
				<p class="text-muted mb-8 text-sm">
					<a href="/auth/login" class="text-secondary hover:text-secondary-dark"
						>Sign in</a
					> to leave a comment.
				</p>
			{/if}

			<div>
				{#each comments as comment}
					<div class="border-rule border-t py-4">
						<p class="kicker">{comment.authorName} · {timeAgo(comment.createdAt)}</p>
						<p class="text-ink mt-2 text-sm leading-relaxed whitespace-pre-wrap">
							{comment.content}
						</p>
						{#if get(currentUser)?._id === comment.authorId}
							<button
								onclick={async () => {
									const token = getToken();
									if (!token) return;
									try {
										await mutation("comments:remove", {
											token,
											id: comment._id,
										});
										const updated = await query("details:getNoteWithDetails", {
											id: page.params.id,
										});
										if (updated) comments = (updated as any).comments ?? [];
									} catch (e) {}
								}}
								class="text-primary hover:text-primary-dark mt-2 text-xs"
								>Delete</button
							>
						{/if}
					</div>
				{:else}
					<p class="text-muted text-sm">No comments yet.</p>
				{/each}
			</div>
		</section>
	{:else}
		<h1 class="text-ink font-serif text-3xl">Note not found</h1>
		<p class="text-muted mt-2 text-sm">This note may have been deleted or doesn't exist.</p>
		<a href="/notes" class="text-secondary hover:text-secondary-dark mt-4 inline-block text-sm"
			>Back to notes</a
		>
	{/if}
</div>
