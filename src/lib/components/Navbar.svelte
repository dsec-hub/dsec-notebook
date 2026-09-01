<script lang="ts">
	import { isAuthenticated, initAuth, logout, currentUser } from "$lib/stores/auth";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";

	let mobileMenuOpen = $state(false);
	let auth = $state(false);
	let admin = $state(false);
	let searchQuery = $state("");

	function submitSearch(e: SubmitEvent) {
		e.preventDefault();
		const q = searchQuery.trim();
		if (!q) return;
		mobileMenuOpen = false;
		searchQuery = "";
		goto(`/search?q=${encodeURIComponent(q)}`);
	}

	onMount(() => {
		initAuth();
		const unsubAuth = isAuthenticated.subscribe((v) => (auth = v));
		const unsubUser = currentUser.subscribe((u) => (admin = u?.role === "admin"));
		return () => {
			unsubAuth();
			unsubUser();
		};
	});

	const path = $derived(page.url.pathname);
	const onNotes = $derived(path === "/notes" || path.startsWith("/notes/"));
	const onQuestions = $derived(path === "/questions" || path.startsWith("/questions/"));
	const onAdmin = $derived(path === "/admin" || path.startsWith("/admin/"));
</script>

<header class="border-rule border-b bg-white">
	<div class="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
		<a href="/" class="text-ink font-serif text-[1.65rem] leading-none">Notebook</a>

		<nav class="hidden items-center gap-8 md:flex">
			<a href="/notes" class="nav-link {onNotes ? 'nav-link-active' : ''}">Notes</a>
			<a href="/questions" class="nav-link {onQuestions ? 'nav-link-active' : ''}"
				>Questions</a
			>
			{#if admin}
				<a href="/admin" class="nav-link {onAdmin ? 'nav-link-active' : ''}">Admin</a>
			{/if}
			{#if auth}
				<button
					type="button"
					class="nav-link"
					onclick={() => {
						logout();
						goto("/");
					}}
				>
					Sign out
				</button>
			{:else}
				<a href="/auth/login" class="nav-link">Sign in</a>
			{/if}
			<form onsubmit={submitSearch}>
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search"
					aria-label="Search notes and questions"
					class="border-rule text-ink placeholder:text-faint focus:border-primary w-40 rounded-none border bg-white px-2.5 py-1.5 text-[11px] tracking-wide transition-colors outline-none"
				/>
			</form>
		</nav>

		<button
			class="text-muted hover:text-ink p-1 md:hidden"
			aria-label="Open menu"
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
		>
			<svg
				class="h-5 w-5"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path stroke-linecap="square" d="M4 7h16M4 12h16M4 17h16" />
			</svg>
		</button>
	</div>

	{#if mobileMenuOpen}
		<nav class="border-rule space-y-3 border-t px-4 py-4 md:hidden">
			<form onsubmit={submitSearch}>
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search"
					aria-label="Search notes and questions"
					class="border-rule text-ink placeholder:text-faint focus:border-primary w-full rounded-none border bg-white px-3 py-2 text-sm tracking-wide transition-colors outline-none"
				/>
			</form>
			<a href="/notes" class="nav-link block" onclick={() => (mobileMenuOpen = false)}
				>Notes</a
			>
			<a href="/questions" class="nav-link block" onclick={() => (mobileMenuOpen = false)}
				>Questions</a
			>
			{#if admin}
				<a href="/admin" class="nav-link block" onclick={() => (mobileMenuOpen = false)}
					>Admin</a
				>
			{/if}
			{#if auth}
				<button
					type="button"
					class="nav-link block"
					onclick={() => {
						logout();
						goto("/");
						mobileMenuOpen = false;
					}}
				>
					Sign out
				</button>
			{:else}
				<a
					href="/auth/login"
					class="nav-link block"
					onclick={() => (mobileMenuOpen = false)}>Sign in</a
				>
			{/if}
		</nav>
	{/if}
</header>
