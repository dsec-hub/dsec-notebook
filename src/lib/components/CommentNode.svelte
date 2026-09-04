<script lang="ts">
	import { mutation } from "$lib/api";
	import { getToken, currentUser, isAuthenticated } from "$lib/stores/auth";
	import { get } from "svelte/store";
	import { timeAgo } from "$lib/time";
	import CommentNode from "./CommentNode.svelte";
	import Avatar from "./Avatar.svelte";
	import Markdown from "./Markdown.svelte";
	import type { CommentDoc } from "$lib/types";

	interface CommentTreeNode {
		comment: CommentDoc;
		children: CommentTreeNode[];
	}

	let {
		comment,
		children = [],
		targetType,
		targetId,
		reload,
	}: {
		comment: CommentDoc;
		children?: CommentTreeNode[];
		targetType: "note" | "question";
		targetId: string;
		reload: () => Promise<void>;
	} = $props();

	let collapsed = $state(false);
	let replying = $state(false);
	let replyText = $state("");
	let replyLoading = $state(false);
	let replyError = $state("");

	let editing = $state(false);
	let editText = $state("");
	let editLoading = $state(false);
	let editError = $state("");

	let deleteLoading = $state(false);

	const isMine = $derived(get(currentUser)?._id === comment.authorId);
	const edited = $derived(comment.updatedAt != null && comment.updatedAt > comment.createdAt);

	async function submitReply() {
		if (!replyText.trim()) return;
		const token = getToken();
		if (!token) {
			replyError = "Please sign in to reply";
			return;
		}

		replyLoading = true;
		replyError = "";
		try {
			await mutation(
				targetType === "note" ? "comments:createOnNote" : "comments:createOnQuestion",
				targetType === "note"
					? {
							token,
							content: replyText.trim(),
							parentId: targetId,
							parentCommentId: comment._id,
						}
					: {
							token,
							content: replyText.trim(),
							questionId: targetId,
							parentCommentId: comment._id,
						},
			);
			replyText = "";
			replying = false;
			collapsed = false;
			await reload();
		} catch (err: any) {
			replyError = err.message ?? "Failed to post reply";
		} finally {
			replyLoading = false;
		}
	}

	function startEdit() {
		editText = comment.content;
		editError = "";
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		editError = "";
	}

	async function saveEdit() {
		if (!editText.trim()) {
			editError = "Comment cannot be empty";
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
			await mutation("comments:update", { token, id: comment._id, content: editText.trim() });
			editing = false;
			await reload();
		} catch (err: any) {
			editError = err.message ?? "Failed to save";
		} finally {
			editLoading = false;
		}
	}

	async function remove() {
		const token = getToken();
		if (!token) return;
		if (!confirm("Delete this comment and its replies?")) return;

		deleteLoading = true;
		try {
			await mutation("comments:remove", { token, id: comment._id });
			await reload();
		} catch (err: any) {
			alert(err.message ?? "Failed to delete");
		} finally {
			deleteLoading = false;
		}
	}
</script>

<div class="py-3">
	<div class="flex gap-3">
		<a href={`/users/${comment.authorId}`} aria-label={`View ${comment.authorName}'s profile`}>
			<Avatar src={comment.avatarUrl} name={comment.authorName} />
		</a>
		<div class="min-w-0 flex-1">
			<p class="kicker">
				<a href={`/users/${comment.authorId}`} class="hover:text-primary"
					>{comment.authorName}</a
				>
				· <span class="text-faint">{timeAgo(comment.createdAt)}</span>
				{#if edited}
					· Edited
				{/if}
			</p>

			{#if editing}
				<textarea bind:value={editText} rows={3} class="field mt-2 resize-y"></textarea>
				<div class="mt-2 flex items-center gap-3">
					<button
						type="button"
						onclick={saveEdit}
						disabled={editLoading}
						class="btn-primary"
					>
						{editLoading ? "Saving..." : "Save"}
					</button>
					<button type="button" onclick={cancelEdit} class="kicker hover:text-ink">
						Cancel
					</button>
					<span class="text-primary text-xs">{editError}</span>
				</div>
			{:else}
				<div class="text-ink mt-1 text-sm leading-relaxed">
					<Markdown content={comment.content} />
				</div>
			{/if}

			<div class="mt-2 flex items-center gap-3">
				{#if get(isAuthenticated)}
					<button
						type="button"
						onclick={() => {
							replying = !replying;
							replyError = "";
						}}
						class="text-secondary hover:text-secondary-dark text-xs"
					>
						Reply
					</button>
				{/if}
				{#if isMine}
					{#if !editing}
						<button
							type="button"
							onclick={startEdit}
							class="text-secondary hover:text-secondary-dark text-xs"
						>
							Edit
						</button>
					{/if}
					<button
						type="button"
						onclick={remove}
						disabled={deleteLoading}
						class="text-primary hover:text-primary-dark text-xs"
					>
						{deleteLoading ? "Deleting..." : "Delete"}
					</button>
				{/if}
			</div>

			{#if replying}
				<div class="mt-3">
					<textarea
						bind:value={replyText}
						rows={2}
						placeholder="Reply..."
						class="field resize-y"></textarea>
					<div class="mt-2 flex items-center gap-3">
						<button
							type="button"
							onclick={submitReply}
							disabled={replyLoading || !replyText.trim()}
							class="btn-primary"
						>
							{replyLoading ? "Posting..." : "Post reply"}
						</button>
						<button
							type="button"
							onclick={() => (replying = false)}
							class="kicker hover:text-ink"
						>
							Cancel
						</button>
						<span class="text-primary text-xs">{replyError}</span>
					</div>
				</div>
			{/if}
		</div>
	</div>

	{#if children.length > 0}
		<div class="mt-1 flex">
			<button
				type="button"
				class="thread-branch"
				onclick={() => (collapsed = !collapsed)}
				title={collapsed ? "Show replies" : "Hide replies"}
				aria-label={collapsed ? "Show replies" : "Hide replies"}
			></button>
			<div class="min-w-0 flex-1 pl-3">
				{#if collapsed}
					<button
						type="button"
						onclick={() => (collapsed = false)}
						class="text-muted hover:text-ink py-1 text-xs"
					>
						Show {children.length} repl{children.length === 1 ? "y" : "ies"}
					</button>
				{:else}
					{#each children as child}
						<CommentNode
							comment={child.comment}
							children={child.children}
							{targetType}
							{targetId}
							{reload}
						/>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
