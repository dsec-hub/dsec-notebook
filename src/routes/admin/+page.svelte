<script lang="ts">
	import { onMount } from "svelte";
	import { query, mutation } from "$lib/api";
	import { adminCompleteSetup, adminRequestCode, getToken, initAuth } from "$lib/stores/auth";
	import { timeAgo } from "$lib/time";
	import type { UnitDoc, UserDoc } from "$lib/types";

	type Tab = "overview" | "units" | "accounts" | "notes";

	type AdminState = {
		hasAdmin: boolean;
		currentUser: UserDoc | null;
		isAdmin: boolean;
	};

	type WeekStat = { weekStart: number; notes: number; questions: number };
	type Stats = {
		weeks: WeekStat[];
		totals: { notes: number; questions: number; users: number; units: number };
	};

	type AdminUser = UserDoc & { noteCount: number; questionCount: number };
	type AdminNote = {
		_id: string;
		title: string;
		content: string;
		unitId: string;
		authorName: string;
		createdAt: number;
		unitCode?: string;
		unitCode2?: string;
		voteCount: number;
		commentCount: number;
	};

	let loading = $state(true);
	let adminState = $state<AdminState | null>(null);
	let tab = $state<Tab>("overview");
	let token = "";

	// First-time admin setup
	let setupStep = $state<"email" | "code">("email");
	let setupEmail = $state("");
	let setupName = $state("");
	let setupCode = $state("");
	let setupError = $state("");
	let setupLoading = $state(false);

	// Dashboard data
	let stats = $state<Stats | null>(null);
	let units = $state<UnitDoc[]>([]);
	let users = $state<AdminUser[]>([]);
	let notes = $state<AdminNote[]>([]);
	let pageError = $state("");

	// Unit editor
	let unitForm = $state({ id: "", code: "", code2: "", name: "", description: "" });
	let unitBusy = $state(false);
	let unitError = $state("");
	let unitSuccess = $state("");

	// Account editor
	let userForm = $state<{ id: string; email: string; name: string; role: string } | null>(null);
	let userBusy = $state(false);
	let userError = $state("");

	// Note editor
	let noteForm = $state<{ id: string; title: string; content: string } | null>(null);
	let noteBusy = $state(false);
	let noteError = $state("");

	const isDeakin = (value: string) => value.toLowerCase().endsWith("@deakin.edu.au");
	const maxCount = $derived(
		stats ? Math.max(1, ...stats.weeks.map((w) => Math.max(w.notes, w.questions))) : 1,
	);

	function adminToken(): string {
		return getToken() ?? token;
	}

	function barHeight(value: number): string {
		return `${Math.round((value / maxCount) * 128)}px`;
	}

	function weekLabel(ts: number): string {
		const d = new Date(ts);
		return `${d.getDate()} ${d.toLocaleDateString("en-AU", { month: "short" })}`;
	}

	async function loadDashboard() {
		const t = getToken();
		const state = (await query("admin:getState", t ? { token: t } : {})) as AdminState;
		adminState = state;

		if (state.hasAdmin && state.isAdmin && t) {
			token = t;
			const [s, u, us, n] = await Promise.all([
				query("admin:stats", { token: t, weeks: 8 }),
				query("units:getAll"),
				query("admin:usersList", { token: t }),
				query("admin:notesList", { token: t }),
			]);
			stats = s as Stats;
			units = u as UnitDoc[];
			users = us as AdminUser[];
			notes = n as AdminNote[];
		}
	}

	onMount(async () => {
		await initAuth();
		try {
			await loadDashboard();
		} catch (err: any) {
			pageError = err.message ?? "Failed to load the dashboard";
		} finally {
			loading = false;
		}
	});

	async function handleSetupSubmit(e: SubmitEvent) {
		e.preventDefault();
		setupError = "";

		if (setupStep === "email") {
			if (!setupEmail.trim()) {
				setupError = "Please enter your Deakin email";
				return;
			}
			if (!isDeakin(setupEmail)) {
				setupError = "Only @deakin.edu.au email addresses are allowed";
				return;
			}
			setupLoading = true;
			try {
				await adminRequestCode(setupEmail.trim(), setupName.trim());
				setupStep = "code";
			} catch (err: any) {
				setupError = err.message ?? "Failed to send the code";
			} finally {
				setupLoading = false;
			}
			return;
		}

		if (!setupCode.trim()) {
			setupError = "Please enter the verification code";
			return;
		}
		setupLoading = true;
		try {
			await adminCompleteSetup(setupEmail.trim(), setupCode.trim());
			await loadDashboard();
		} catch (err: any) {
			setupError = err.message ?? "Failed to verify the code";
		} finally {
			setupLoading = false;
		}
	}

	// ---- units ----

	function startEditUnit(unit: UnitDoc) {
		unitForm = {
			id: unit._id,
			code: unit.code,
			code2: unit.code2 ?? "",
			name: unit.name,
			description: unit.description ?? "",
		};
		unitError = "";
		unitSuccess = "";
	}

	function resetUnitForm() {
		unitForm = { id: "", code: "", code2: "", name: "", description: "" };
		unitError = "";
		unitSuccess = "";
	}

	async function saveUnit(e: SubmitEvent) {
		e.preventDefault();
		unitError = "";
		unitSuccess = "";
		unitBusy = true;
		try {
			await mutation("admin:unitsSave", {
				token: adminToken(),
				id: unitForm.id || undefined,
				code: unitForm.code,
				code2: unitForm.code2,
				name: unitForm.name,
				description: unitForm.description,
			});
			units = (await query("units:getAll")) as UnitDoc[];
			unitSuccess = unitForm.id ? "Unit updated." : "Unit created.";
			resetUnitForm();
		} catch (err: any) {
			unitError = err.message ?? "Failed to save unit";
		} finally {
			unitBusy = false;
		}
	}

	async function deleteUnit(unit: UnitDoc) {
		if (!confirm(`Delete unit ${unit.code}?`)) return;
		unitError = "";
		unitSuccess = "";
		try {
			await mutation("admin:unitsDelete", { token: adminToken(), id: unit._id });
			units = (await query("units:getAll")) as UnitDoc[];
		} catch (err: any) {
			unitError = err.message ?? "Failed to delete unit";
		}
	}

	// ---- accounts ----

	function startEditUser(user: AdminUser) {
		userForm = { id: user._id, email: user.email, name: user.name, role: user.role };
		userError = "";
	}

	function resetUserForm() {
		userForm = null;
		userError = "";
	}

	async function saveUser(e: SubmitEvent) {
		e.preventDefault();
		if (!userForm) return;
		userError = "";
		userBusy = true;
		try {
			await mutation("admin:usersUpdate", {
				token: adminToken(),
				id: userForm.id,
				email: userForm.email,
				name: userForm.name,
				role: userForm.role,
			});
			users = (await query("admin:usersList", { token: adminToken() })) as AdminUser[];
			resetUserForm();
		} catch (err: any) {
			userError = err.message ?? "Failed to update account";
		} finally {
			userBusy = false;
		}
	}

	async function toggleRole(user: AdminUser) {
		userError = "";
		try {
			await mutation("admin:usersUpdate", {
				token: adminToken(),
				id: user._id,
				email: user.email,
				name: user.name,
				role: user.role === "admin" ? "user" : "admin",
			});
			users = (await query("admin:usersList", { token: adminToken() })) as AdminUser[];
		} catch (err: any) {
			userError = err.message ?? "Failed to change role";
		}
	}

	async function deleteUser(user: AdminUser) {
		if (!confirm(`Delete ${user.email} and all of their content?`)) return;
		userError = "";
		try {
			await mutation("admin:usersDelete", { token: adminToken(), id: user._id });
			users = (await query("admin:usersList", { token: adminToken() })) as AdminUser[];
		} catch (err: any) {
			userError = err.message ?? "Failed to delete account";
		}
	}

	// ---- notes ----

	function startEditNote(note: AdminNote) {
		noteForm = { id: note._id, title: note.title, content: note.content };
		noteError = "";
	}

	function resetNoteForm() {
		noteForm = null;
		noteError = "";
	}

	async function saveNote(e: SubmitEvent) {
		e.preventDefault();
		if (!noteForm) return;
		noteError = "";
		noteBusy = true;
		try {
			await mutation("admin:notesUpdate", {
				token: adminToken(),
				id: noteForm.id,
				title: noteForm.title,
				content: noteForm.content,
			});
			notes = (await query("admin:notesList", { token: adminToken() })) as AdminNote[];
			resetNoteForm();
		} catch (err: any) {
			noteError = err.message ?? "Failed to update note";
		} finally {
			noteBusy = false;
		}
	}

	async function deleteNote(note: AdminNote) {
		if (!confirm(`Delete note "${note.title}"?`)) return;
		noteError = "";
		try {
			await mutation("admin:notesDelete", { token: adminToken(), id: note._id });
			notes = (await query("admin:notesList", { token: adminToken() })) as AdminNote[];
		} catch (err: any) {
			noteError = err.message ?? "Failed to delete note";
		}
	}
</script>

<svelte:head>
	<title>Admin — Notebook</title>
</svelte:head>

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if !adminState}
		<h1 class="text-ink font-serif text-3xl">Unable to load the dashboard</h1>
		<p class="text-muted mt-2 text-sm">{pageError}</p>
	{:else if !adminState.hasAdmin}
		<div class="mx-auto max-w-md">
			<p class="kicker">Admin setup</p>
			<h1 class="text-ink mt-2 font-serif text-4xl font-medium">Create the first admin</h1>
			<p class="text-muted mt-2 mb-8 text-[15px]">
				This notebook doesn't have an admin yet. Verify your Deakin email to take ownership
				of the dashboard.
			</p>

			{#if setupStep === "email"}
				<form onsubmit={handleSetupSubmit} class="border-rule space-y-5 border-t pt-8">
					<div>
						<label for="setup-email" class="kicker mb-2 block">Deakin email</label>
						<input
							id="setup-email"
							type="email"
							bind:value={setupEmail}
							placeholder="@deakin.edu.au"
							class="field"
							required
						/>
					</div>
					<div>
						<label for="setup-name" class="kicker mb-2 block">Full name</label>
						<input
							id="setup-name"
							type="text"
							bind:value={setupName}
							placeholder="Only needed for a new account"
							class="field"
						/>
					</div>

					{#if setupError}
						<p class="text-primary text-sm">{setupError}</p>
					{/if}

					<button type="submit" disabled={setupLoading} class="btn-primary w-full">
						{setupLoading ? "Sending code..." : "Send verification code"}
					</button>
				</form>
			{:else}
				<form onsubmit={handleSetupSubmit} class="border-rule space-y-5 border-t pt-8">
					<p class="text-muted text-sm">
						We sent a 6-digit code to <span class="text-ink">{setupEmail}</span>. It
						expires in 10 minutes.
					</p>

					<div>
						<label for="setup-code" class="kicker mb-2 block">Verification code</label>
						<input
							id="setup-code"
							type="text"
							inputmode="numeric"
							maxlength="6"
							autocomplete="one-time-code"
							bind:value={setupCode}
							placeholder="000000"
							class="field"
							required
						/>
					</div>

					{#if setupError}
						<p class="text-primary text-sm">{setupError}</p>
					{/if}

					<button type="submit" disabled={setupLoading} class="btn-primary w-full">
						{setupLoading ? "Verifying..." : "Verify and become admin"}
					</button>

					<button
						type="button"
						onclick={() => {
							setupStep = "email";
							setupCode = "";
							setupError = "";
						}}
						class="text-muted hover:text-ink text-sm"
					>
						Use a different email
					</button>
				</form>
			{/if}
		</div>
	{:else if !adminState.isAdmin}
		<h1 class="text-ink font-serif text-4xl font-medium">Admin</h1>
		<p class="text-muted mt-2 text-sm">You need to be an admin to view this page.</p>
		{#if !adminState.currentUser}
			<a
				href="/auth/login"
				class="text-secondary hover:text-secondary-dark mt-4 inline-block text-sm"
			>
				Sign in
			</a>
		{/if}
	{:else}
		<div class="border-rule flex items-end justify-between gap-4 border-b pb-6">
			<div>
				<p class="kicker">Admin</p>
				<h1 class="text-ink mt-2 font-serif text-4xl font-medium">Dashboard</h1>
			</div>
			<div class="flex gap-2">
				<button
					type="button"
					class="chip {tab === 'overview' ? 'chip-active' : ''}"
					onclick={() => (tab = "overview")}
				>
					Overview
				</button>
				<button
					type="button"
					class="chip {tab === 'units' ? 'chip-active' : ''}"
					onclick={() => (tab = "units")}
				>
					Units
				</button>
				<button
					type="button"
					class="chip {tab === 'accounts' ? 'chip-active' : ''}"
					onclick={() => (tab = "accounts")}
				>
					Accounts
				</button>
				<button
					type="button"
					class="chip {tab === 'notes' ? 'chip-active' : ''}"
					onclick={() => (tab = "notes")}
				>
					Notes
				</button>
			</div>
		</div>

		{#if pageError}
			<p class="text-primary mt-4 text-sm">{pageError}</p>
		{/if}

		{#if tab === "overview"}
			{#if stats}
				<div class="grid grid-cols-2 gap-4 py-8 lg:grid-cols-4">
					<div class="border-rule border p-5">
						<p class="kicker">Notes</p>
						<p class="text-ink mt-2 font-serif text-4xl">{stats.totals.notes}</p>
					</div>
					<div class="border-rule border p-5">
						<p class="kicker">Questions</p>
						<p class="text-ink mt-2 font-serif text-4xl">{stats.totals.questions}</p>
					</div>
					<div class="border-rule border p-5">
						<p class="kicker">Accounts</p>
						<p class="text-ink mt-2 font-serif text-4xl">{stats.totals.users}</p>
					</div>
					<div class="border-rule border p-5">
						<p class="kicker">Units</p>
						<p class="text-ink mt-2 font-serif text-4xl">{stats.totals.units}</p>
					</div>
				</div>

				<div class="border-rule border-t pt-8">
					<div class="flex items-center justify-between">
						<p class="kicker">Posts — last {stats.weeks.length} weeks</p>
						<div class="flex gap-4 text-[11px] tracking-[0.14em] uppercase">
							<span class="text-ink"><span class="text-primary">■</span> Notes</span>
							<span class="text-ink"
								><span class="text-secondary">■</span> Questions</span
							>
						</div>
					</div>

					<div class="mt-6 flex items-end gap-3 overflow-x-auto pb-2">
						{#each stats.weeks as week}
							<div class="flex min-w-[72px] flex-1 flex-col items-center gap-1">
								<div class="flex h-32 w-full items-end justify-center gap-1">
									<div
										class="bg-primary w-1/3 max-w-6"
										style="height: {barHeight(week.notes)}"
										title="{week.notes} notes"
									></div>
									<div
										class="bg-secondary w-1/3 max-w-6"
										style="height: {barHeight(week.questions)}"
										title="{week.questions} questions"
									></div>
								</div>
								<span class="kicker">{weekLabel(week.weekStart)}</span>
								<span class="text-faint text-[10px]"
									>{week.notes} notes · {week.questions} questions</span
								>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{:else if tab === "units"}
			<div class="grid gap-10 py-8 lg:grid-cols-[1fr_340px]">
				<div>
					<div class="flex items-baseline justify-between">
						<p class="kicker">All units</p>
						<span class="text-faint text-xs">{units.length} total</span>
					</div>
					<div class="border-rule mt-4 border-t">
						{#each units as unit}
							<div
								class="border-rule flex items-center justify-between gap-4 border-b py-3"
							>
								<div class="min-w-0">
									<p class="text-ink font-medium">
										{unit.code}{unit.code2 ? ` / ${unit.code2}` : ""}
									</p>
									<p class="text-muted truncate text-sm">{unit.name}</p>
								</div>
								<div class="flex shrink-0 gap-3">
									<button
										type="button"
										class="text-secondary hover:text-secondary-dark text-[11px] font-medium tracking-[0.14em] uppercase"
										onclick={() => startEditUnit(unit)}
									>
										Edit
									</button>
									<button
										type="button"
										class="text-primary text-[11px] font-medium tracking-[0.14em] uppercase"
										onclick={() => deleteUnit(unit)}
									>
										Delete
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<form
					onsubmit={saveUnit}
					class="border-rule sticky top-5 h-fit space-y-5 border p-5"
				>
					<p class="kicker">{unitForm.id ? "Edit unit" : "Add unit"}</p>
					<div>
						<label for="unit-code" class="kicker mb-2 block">Code</label>
						<input
							id="unit-code"
							type="text"
							bind:value={unitForm.code}
							placeholder="e.g., SIT102"
							class="field"
							required
						/>
					</div>
					<div>
						<label for="unit-code2" class="kicker mb-2 block"
							>Second code (optional)</label
						>
						<input
							id="unit-code2"
							type="text"
							bind:value={unitForm.code2}
							placeholder="e.g., SIT103"
							class="field"
						/>
					</div>
					<div>
						<label for="unit-name" class="kicker mb-2 block">Name</label>
						<input
							id="unit-name"
							type="text"
							bind:value={unitForm.name}
							placeholder="Unit name"
							class="field"
							required
						/>
					</div>
					<div>
						<label for="unit-description" class="kicker mb-2 block">Description</label>
						<textarea
							id="unit-description"
							bind:value={unitForm.description}
							rows={3}
							placeholder="Optional"
							class="field resize-y"></textarea>
					</div>

					{#if unitError}
						<p class="text-primary text-sm">{unitError}</p>
					{/if}
					{#if unitSuccess}
						<p class="text-secondary text-sm">{unitSuccess}</p>
					{/if}

					<div class="flex gap-2">
						<button type="submit" disabled={unitBusy} class="btn-primary flex-1">
							{unitBusy ? "Saving..." : unitForm.id ? "Save changes" : "Create unit"}
						</button>
						{#if unitForm.id}
							<button type="button" onclick={resetUnitForm} class="btn-ghost">
								Cancel
							</button>
						{/if}
					</div>
				</form>
			</div>
		{:else if tab === "accounts"}
			<div class="grid gap-10 py-8 lg:grid-cols-[1fr_340px]">
				<div>
					<div class="flex items-baseline justify-between">
						<p class="kicker">All accounts</p>
						<span class="text-faint text-xs">{users.length} total</span>
					</div>
					<div class="border-rule mt-4 border-t">
						{#each users as user}
							<div class="border-rule border-b py-3">
								<div class="flex items-center justify-between gap-4">
									<div class="min-w-0">
										<p class="text-ink font-medium">{user.name}</p>
										<p class="text-muted truncate text-sm">{user.email}</p>
									</div>
									<span class="chip {user.role === 'admin' ? 'chip-active' : ''}">
										{user.role}
									</span>
								</div>
								<div class="mt-2 flex flex-wrap items-center gap-3 text-xs">
									<span class="text-faint"
										>{user.noteCount} note{user.noteCount === 1
											? ""
											: "s"}</span
									>
									<span class="text-faint"
										>{user.questionCount} question{user.questionCount === 1
											? ""
											: "s"}</span
									>
									<div class="ml-auto flex gap-3">
										<button
											type="button"
											class="text-secondary hover:text-secondary-dark text-[11px] font-medium tracking-[0.14em] uppercase"
											onclick={() => toggleRole(user)}
										>
											{user.role === "admin" ? "Make user" : "Make admin"}
										</button>
										<button
											type="button"
											class="text-secondary hover:text-secondary-dark text-[11px] font-medium tracking-[0.14em] uppercase"
											onclick={() => startEditUser(user)}
										>
											Edit
										</button>
										<button
											type="button"
											class="text-primary text-[11px] font-medium tracking-[0.14em] uppercase"
											onclick={() => deleteUser(user)}
										>
											Delete
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>

					{#if userError}
						<p class="text-primary mt-4 text-sm">{userError}</p>
					{/if}
				</div>

				<div class="border-rule h-fit border p-5">
					{#if userForm}
						<form onsubmit={saveUser} class="space-y-5">
							<p class="kicker">Edit account</p>
							<div>
								<label for="user-name" class="kicker mb-2 block">Name</label>
								<input
									id="user-name"
									type="text"
									bind:value={userForm.name}
									class="field"
									required
								/>
							</div>
							<div>
								<label for="user-email" class="kicker mb-2 block"
									>Deakin email</label
								>
								<input
									id="user-email"
									type="email"
									bind:value={userForm.email}
									class="field"
									required
								/>
							</div>
							<div>
								<label for="user-role" class="kicker mb-2 block">Role</label>
								<select id="user-role" bind:value={userForm.role} class="field">
									<option value="user">User</option>
									<option value="admin">Admin</option>
								</select>
							</div>

							{#if userError}
								<p class="text-primary text-sm">{userError}</p>
							{/if}

							<div class="flex gap-2">
								<button
									type="submit"
									disabled={userBusy}
									class="btn-primary flex-1"
								>
									{userBusy ? "Saving..." : "Save changes"}
								</button>
								<button type="button" onclick={resetUserForm} class="btn-ghost">
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<p class="kicker">Account editor</p>
						<p class="text-muted mt-4 text-sm">
							Select an account and choose Edit to change its name, email, or role.
						</p>
					{/if}
				</div>
			</div>
		{:else if tab === "notes"}
			<div class="grid gap-10 py-8 lg:grid-cols-[1fr_340px]">
				<div>
					<div class="flex items-baseline justify-between">
						<p class="kicker">All notes</p>
						<span class="text-faint text-xs">{notes.length} total</span>
					</div>
					<div class="border-rule mt-4 border-t">
						{#each notes as note}
							<div class="border-rule border-b py-3">
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0">
										<p class="text-ink font-medium">{note.title}</p>
										<p class="text-muted mt-1 truncate text-sm">
											{note.unitCode
												? note.unitCode +
													(note.unitCode2 ? ` / ${note.unitCode2}` : "")
												: "—"} · {note.authorName} · {timeAgo(
												note.createdAt,
											)}
										</p>
									</div>
									<div class="flex shrink-0 gap-3">
										<button
											type="button"
											class="text-secondary hover:text-secondary-dark text-[11px] font-medium tracking-[0.14em] uppercase"
											onclick={() => startEditNote(note)}
										>
											Edit
										</button>
										<button
											type="button"
											class="text-primary text-[11px] font-medium tracking-[0.14em] uppercase"
											onclick={() => deleteNote(note)}
										>
											Delete
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>

					{#if noteError}
						<p class="text-primary mt-4 text-sm">{noteError}</p>
					{/if}
				</div>

				<div class="border-rule h-fit border p-5">
					{#if noteForm}
						<form onsubmit={saveNote} class="space-y-5">
							<p class="kicker">Edit note</p>
							<div>
								<label for="note-title" class="kicker mb-2 block">Title</label>
								<input
									id="note-title"
									type="text"
									bind:value={noteForm.title}
									class="field"
									required
								/>
							</div>
							<div>
								<label for="note-content" class="kicker mb-2 block">Content</label>
								<textarea
									id="note-content"
									bind:value={noteForm.content}
									rows={12}
									class="field resize-y"
									required></textarea>
							</div>

							{#if noteError}
								<p class="text-primary text-sm">{noteError}</p>
							{/if}

							<div class="flex gap-2">
								<button
									type="submit"
									disabled={noteBusy}
									class="btn-primary flex-1"
								>
									{noteBusy ? "Saving..." : "Save changes"}
								</button>
								<button type="button" onclick={resetNoteForm} class="btn-ghost">
									Cancel
								</button>
							</div>
						</form>
					{:else}
						<p class="kicker">Note editor</p>
						<p class="text-muted mt-4 text-sm">
							Select a note and choose Edit to update its title or content.
						</p>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
