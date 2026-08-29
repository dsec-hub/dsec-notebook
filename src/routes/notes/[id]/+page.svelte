<script lang="ts">
  import { query, mutation } from '$lib/api';
  import { isAuthenticated, getToken, currentUser } from '$lib/stores/auth';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import VoteStack from '$lib/components/VoteStack.svelte';
  import { timeAgo } from '$lib/time';
  import type { NoteDoc, CommentDoc, TopicDoc, UnitDoc } from '$lib/types';

  let note: NoteDoc | null = $state(null);
  let topic: TopicDoc | null = $state(null);
  let unit: UnitDoc | null = $state(null);
  let comments: CommentDoc[] = $state([]);
  let loading = $state(true);

  let commentText = $state('');
  let commentError = $state('');
  let commentLoading = $state(false);
  let deleteLoading = $state(false);
  let isAuthor = $state(false);

  onMount(async () => {
    const id = page.params.id;
    const result = await query('details:getNoteWithDetails', { id });
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
      commentError = 'Please sign in to comment';
      return;
    }

    commentLoading = true;
    commentError = '';
    try {
      await mutation('comments:createOnNote', {
        token,
        content: commentText.trim(),
        parentId: page.params.id
      });
      commentText = '';
      const updated = await query('details:getNoteWithDetails', { id: page.params.id });
      if (updated) comments = (updated as any).comments ?? [];
    } catch (err: any) {
      commentError = err.message ?? 'Failed to post comment';
    } finally {
      commentLoading = false;
    }
  }

  async function deleteNote() {
    const token = getToken();
    if (!token || !note) return;
    if (!confirm('Delete this note?')) return;

    deleteLoading = true;
    try {
      await mutation('notes:remove', { token, id: note._id });
      window.location.href = '/notes';
    } catch (err: any) {
      alert(err.message ?? 'Failed to delete');
    } finally {
      deleteLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{note?.title ?? 'Loading...'} — Notebook</title>
</svelte:head>

<div class="page">
  {#if loading}
    <p class="kicker py-16">Loading</p>
  {:else if note}
    <div class="flex gap-5">
      <VoteStack count={note.voteCount} targetType="note" targetId={note._id} />
      <div class="min-w-0 flex-1">
        <p class="kicker">
          {#if unit}{unit.code}{/if}{#if unit && topic} · {/if}{#if topic}{topic.name}{/if}
        </p>
        <h1 class="mt-2 font-serif text-3xl font-medium leading-tight text-ink sm:text-4xl">{note.title}</h1>
        <p class="kicker mt-3">
          {note.authorName} · {timeAgo(note.createdAt)}
          {#if isAuthor}
            ·
            <button
              type="button"
              onclick={deleteNote}
              disabled={deleteLoading}
              class="text-primary hover:text-primary-dark"
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </button>
          {/if}
        </p>
      </div>
    </div>

    <div class="mt-8 whitespace-pre-wrap border-t border-rule pt-8 text-[15px] leading-relaxed text-ink">
      {note.content}
    </div>

    <section class="mt-12 border-t border-rule pt-8">
      <p class="kicker mb-6">Comments ({comments.length})</p>

      {#if get(isAuthenticated)}
        <div class="mb-8">
          <textarea bind:value={commentText} rows={3} placeholder="Add a comment..." class="field resize-y"></textarea>
          <div class="mt-3 flex items-center justify-between">
            <span class="text-xs text-primary">{commentError}</span>
            <button
              onclick={postComment}
              disabled={commentLoading || !commentText.trim()}
              class="btn-primary"
            >
              {commentLoading ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </div>
      {:else}
        <p class="mb-8 text-sm text-muted">
          <a href="/auth/login" class="text-secondary hover:text-secondary-dark">Sign in</a> to leave a comment.
        </p>
      {/if}

      <div>
        {#each comments as comment}
          <div class="border-t border-rule py-4">
            <p class="kicker">{comment.authorName} · {timeAgo(comment.createdAt)}</p>
            <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{comment.content}</p>
            {#if get(currentUser)?._id === comment.authorId}
              <button
                onclick={async () => {
                  const token = getToken();
                  if (!token) return;
                  try {
                    await mutation('comments:remove', { token, id: comment._id });
                    const updated = await query('details:getNoteWithDetails', { id: page.params.id });
                    if (updated) comments = (updated as any).comments ?? [];
                  } catch (e) {}
                }}
                class="mt-2 text-xs text-primary hover:text-primary-dark"
              >Delete</button>
            {/if}
          </div>
        {:else}
          <p class="text-sm text-muted">No comments yet.</p>
        {/each}
      </div>
    </section>
  {:else}
    <h1 class="font-serif text-3xl text-ink">Note not found</h1>
    <p class="mt-2 text-sm text-muted">This note may have been deleted or doesn't exist.</p>
    <a href="/notes" class="mt-4 inline-block text-sm text-secondary hover:text-secondary-dark">Back to notes</a>
  {/if}
</div>
