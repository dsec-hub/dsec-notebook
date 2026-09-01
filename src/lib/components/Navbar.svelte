<script lang="ts">
	import { isAuthenticated, initAuth, logout, currentUser } from "$lib/stores/auth";
	import { theme, toggleTheme } from "$lib/stores/theme";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";

	let mobileMenuOpen = $state(false);
	let auth = $state(false);
	let admin = $state(false);
	let searchQuery = $state("");
	let isDark = $state(false);

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
		const unsubTheme = theme.subscribe((t) => (isDark = t === "dark"));
		return () => {
			unsubAuth();
			unsubUser();
			unsubTheme();
		};
	});

	const path = $derived(page.url.pathname);
	const onNotes = $derived(path === "/notes" || path.startsWith("/notes/"));
	const onQuestions = $derived(path === "/questions" || path.startsWith("/questions/"));
	const onAdmin = $derived(path === "/admin" || path.startsWith("/admin/"));
</script>

<header class="border-rule bg-surface border-b">
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
						if (!confirm("Sign out?")) return;
						logout();
						goto("/");
					}}
				>
					Sign out
				</button>
			{:else}
				<a href="/auth/login" class="nav-link">Sign in</a>
			{/if}
			<button
				type="button"
				class="text-muted hover:text-ink p-1"
				aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
				onclick={toggleTheme}
			>
				{#if isDark}
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="4" />
						<path
							stroke-linecap="square"
							d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
						/>
					</svg>
				{:else}
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<path
							stroke-linecap="square"
							d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
						/>
					</svg>
				{/if}
			</button>
			<form onsubmit={submitSearch}>
				<input
					type="search"
					bind:value={searchQuery}
					placeholder="Search"
					aria-label="Search notes and questions"
					class="border-rule text-ink placeholder:text-faint focus:border-primary bg-surface w-40 rounded-sm border px-2.5 py-1.5 text-[11px] tracking-wide transition-colors outline-none"
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
					class="border-rule text-ink placeholder:text-faint focus:border-primary bg-surface w-full rounded-sm border px-3 py-2 text-sm tracking-wide transition-colors outline-none"
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
						if (!confirm("Sign out?")) return;
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
			<button
				type="button"
				class="text-muted hover:text-ink flex items-center gap-2 p-1"
				aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
				onclick={toggleTheme}
			>
				{#if isDark}
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="4" />
						<path
							stroke-linecap="square"
							d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
						/>
					</svg>
				{:else}
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<path
							stroke-linecap="square"
							d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
						/>
					</svg>
				{/if}
			</button>
		</nav>
	{/if}
</header>
