<script lang="ts">
	import CommentNode from "./CommentNode.svelte";
	import type { CommentDoc } from "$lib/types";

	interface CommentTreeNode {
		comment: CommentDoc;
		children: CommentTreeNode[];
	}

	let {
		comments = [],
		targetType,
		targetId,
		reload,
	}: {
		comments?: CommentDoc[];
		targetType: "note" | "question";
		targetId: string;
		reload: () => Promise<void>;
	} = $props();

	const roots = $derived.by(() => {
		const map = new Map<string, CommentTreeNode>();
		for (const comment of comments) {
			map.set(comment._id, { comment, children: [] });
		}
		const result: CommentTreeNode[] = [];
		for (const comment of comments) {
			const node = map.get(comment._id)!;
			if (comment.parentCommentId && map.has(comment.parentCommentId)) {
				map.get(comment.parentCommentId)!.children.push(node);
			} else {
				result.push(node);
			}
		}
		return result;
	});
</script>

<div>
	{#each roots as root}
		<div class="border-rule border-t">
			<CommentNode
				comment={root.comment}
				children={root.children}
				{targetType}
				{targetId}
				{reload}
			/>
		</div>
	{:else}
		<p class="text-muted text-sm">No {targetType === "note" ? "comments" : "answers"} yet.</p>
	{/each}
</div>
