<script lang="ts">
	import { page } from "$app/state";
	import { query } from "$lib/api";
	import Avatar from "$lib/components/Avatar.svelte";
	import { previewMarkdown } from "$lib/markdown";
	import { timeAgo } from "$lib/time";

	type Profile = {
		_id: string;
		name: string;
		avatarUrl?: string;
		_creationTime: number;
		noteCount: number;
		questionCount: number;
		commentCount: number;
		totalContributions: number;
		posts: {
			_id: string;
			type: "note" | "question";
			title: string;
			createdAt: number;
			voteCount: number;
		}[];
		comments: {
			_id: string;
			content: string;
			createdAt: number;
			targetType: "note" | "question";
			targetId: string;
			targetTitle: string | null;
		}[];
	};

	let profile: Profile | null = $state(null);
	let loading = $state(true);
	let tab: "posts" | "comments" = $state("posts");

	$effect(() => {
		const id = page.params.id;
		let cancelled = false;
		loading = true;
		profile = null;
		tab = "posts";

		void (async () => {
			const result = (await query("users:getPublicProfile", {
				id,
			})) as Profile | null;
			if (cancelled) return;
			profile = result;
			loading = false;
		})();

		return () => {
			cancelled = true;
		};
	});

	function contentPath(type: "note" | "question", id: string) {
		return type === "note" ? `/notes/${id}` : `/questions/${id}`;
	}
</script>

<svelte:head>
	<title>{profile?.name ?? "Profile"} — DSEC Notebook</title>
</svelte:head>

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if profile}
		<header class="flex items-center gap-6">
			<Avatar src={profile.avatarUrl} name={profile.name} size="xl" />
			<div>
				<p class="kicker">Contributor</p>
				<h1 class="text-ink mt-2 font-serif text-4xl font-medium">
					{profile.name}
				</h1>
				<p class="text-muted mt-2 text-sm">
					Member since {new Date(profile._creationTime).toLocaleDateString(undefined, {
						month: "long",
						year: "numeric",
					})}
				</p>
			</div>
		</header>

		<section class="border-rule mt-10 grid grid-cols-2 border-y sm:grid-cols-4">
			<div class="border-rule border-r px-4 py-5 first:pl-0">
				<p class="text-ink font-serif text-3xl">
					{profile.totalContributions}
				</p>
				<p class="kicker text-muted mt-1">Contributions</p>
			</div>
			<div class="border-rule border-r px-4 py-5">
				<p class="text-ink font-serif text-3xl">{profile.noteCount}</p>
				<p class="kicker text-muted mt-1">Notes</p>
			</div>
			<div class="border-rule border-r px-4 py-5">
				<p class="text-ink font-serif text-3xl">
					{profile.questionCount}
				</p>
				<p class="kicker text-muted mt-1">Questions</p>
			</div>
			<div class="px-4 py-5">
				<p class="text-ink font-serif text-3xl">
					{profile.commentCount}
				</p>
				<p class="kicker text-muted mt-1">Comments</p>
			</div>
		</section>

		<div class="mt-10 flex gap-5">
			<button
				type="button"
				onclick={() => (tab = "posts")}
				class="kicker border-b-2 pb-2 {tab === 'posts'
					? 'border-primary text-ink'
					: 'text-muted border-transparent'}"
			>
				Posts ({profile.posts.length})
			</button>
			<button
				type="button"
				onclick={() => (tab = "comments")}
				class="kicker border-b-2 pb-2 {tab === 'comments'
					? 'border-primary text-ink'
					: 'text-muted border-transparent'}"
			>
				Comments ({profile.commentCount})
			</button>
		</div>

		<section class="mt-3">
			{#if tab === "posts"}
				{#if profile.posts.length === 0}
					<p class="text-muted border-rule border-t py-8 text-sm">No posts yet.</p>
				{:else}
					{#each profile.posts as post}
						<article class="border-rule border-t py-5">
							<p class="kicker text-secondary">{post.type}</p>
							<a
								href={contentPath(post.type, post._id)}
								class="text-ink hover:text-primary mt-1 block text-[15px] font-semibold"
							>
								{post.title}
							</a>
							<p class="text-faint mt-1 text-xs">
								{timeAgo(post.createdAt)} · {post.voteCount} vote{post.voteCount ===
								1
									? ""
									: "s"}
							</p>
						</article>
					{/each}
				{/if}
			{:else if profile.comments.length === 0}
				<p class="text-muted border-rule border-t py-8 text-sm">No comments yet.</p>
			{:else}
				{#each profile.comments as comment}
					<article class="border-rule border-t py-5">
						<p class="kicker">
							On
							<a
								href={contentPath(comment.targetType, comment.targetId)}
								class="hover:text-primary"
							>
								{comment.targetTitle ?? `a ${comment.targetType}`}
							</a>
						</p>
						<p class="text-ink mt-2 text-sm leading-relaxed">
							{previewMarkdown(comment.content)}
						</p>
						<p class="text-faint mt-1 text-xs">
							{timeAgo(comment.createdAt)}
						</p>
					</article>
				{/each}
			{/if}
		</section>
	{:else}
		<h1 class="text-ink font-serif text-3xl">Profile not found</h1>
		<p class="text-muted mt-2 text-sm">This user does not exist.</p>
	{/if}
</div>
