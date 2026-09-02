<script lang="ts">
	import { goto } from "$app/navigation";
	import { uploadImage, mutation } from "$lib/api";
	import Avatar from "$lib/components/Avatar.svelte";
	import { currentUser, getToken, initAuth, logout, setCurrentUser } from "$lib/stores/auth";
	import type { UserDoc } from "$lib/types";
	import { get } from "svelte/store";
	import { onMount } from "svelte";

	let user: UserDoc | null = $state(null);
	let loading = $state(true);
	let name = $state("");
	let avatarUrl: string | null = $state(null);
	let avatarFile: File | null = $state(null);
	let previewUrl: string | null = $state(null);
	let profileSaving = $state(false);
	let profileMessage = $state("");
	let profileError = $state("");

	let currentPassword = $state("");
	let newPassword = $state("");
	let confirmPassword = $state("");
	let passwordSaving = $state(false);
	let passwordMessage = $state("");
	let passwordError = $state("");

	onMount(async () => {
		await initAuth();
		user = get(currentUser);
		if (!user) {
			goto("/auth/login");
			return;
		}
		name = user.name;
		avatarUrl = user.avatarUrl ?? null;
		loading = false;
	});

	function chooseAvatar(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			profileError = "Please choose an image file";
			return;
		}
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		avatarFile = file;
		previewUrl = URL.createObjectURL(file);
		profileError = "";
		profileMessage = "";
	}

	function removeAvatar() {
		if (previewUrl) URL.revokeObjectURL(previewUrl);
		previewUrl = null;
		avatarFile = null;
		avatarUrl = null;
		profileMessage = "";
	}

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		const token = getToken();
		if (!token) return;
		if (name.trim().length < 2) {
			profileError = "Display name must be at least 2 characters";
			return;
		}

		profileSaving = true;
		profileError = "";
		profileMessage = "";
		try {
			let nextAvatarUrl = avatarUrl;
			if (avatarFile) nextAvatarUrl = await uploadImage(token, avatarFile);
			const updated = (await mutation("users:updateProfile", {
				token,
				name: name.trim(),
				avatarUrl: nextAvatarUrl,
			})) as UserDoc;
			user = updated;
			name = updated.name;
			avatarUrl = updated.avatarUrl ?? null;
			avatarFile = null;
			if (previewUrl) URL.revokeObjectURL(previewUrl);
			previewUrl = null;
			setCurrentUser(updated);
			profileMessage = "Profile saved";
		} catch (err: any) {
			profileError = err.message ?? "Failed to save profile";
		} finally {
			profileSaving = false;
		}
	}

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		const token = getToken();
		if (!token) return;
		if (newPassword.length < 8) {
			passwordError = "New password must be at least 8 characters";
			return;
		}
		if (newPassword !== confirmPassword) {
			passwordError = "New passwords do not match";
			return;
		}

		passwordSaving = true;
		passwordError = "";
		passwordMessage = "";
		try {
			await mutation("users:changePassword", { token, currentPassword, newPassword });
			currentPassword = "";
			newPassword = "";
			confirmPassword = "";
			passwordMessage = "Password changed";
		} catch (err: any) {
			passwordError = err.message ?? "Failed to change password";
		} finally {
			passwordSaving = false;
		}
	}

	function signOut() {
		if (!confirm("Sign out?")) return;
		logout();
		goto("/");
	}
</script>

<svelte:head>
	<title>Account — Notebook</title>
</svelte:head>

<div class="page">
	{#if loading}
		<p class="kicker py-16">Loading</p>
	{:else if user}
		<div class="flex items-start justify-between gap-6">
			<div>
				<p class="kicker">Account</p>
				<h1 class="text-ink mt-2 font-serif text-4xl font-medium">Your profile</h1>
				<p class="text-muted mt-2 text-sm">
					<a href={`/users/${user._id}`} class="text-secondary hover:text-secondary-dark"
						>View your public profile</a
					>
				</p>
			</div>
			<button type="button" onclick={signOut} class="btn-ghost shrink-0">Sign out</button>
		</div>

		<div class="mt-10 grid gap-12 md:grid-cols-2">
			<form onsubmit={saveProfile} class="border-rule space-y-6 border-t pt-7">
				<div>
					<p class="kicker mb-3">Profile picture</p>
					<div class="flex items-center gap-5">
						<Avatar src={previewUrl ?? avatarUrl} name={name || user.name} size="lg" />
						<div class="flex flex-wrap gap-2">
							<label class="btn-secondary">
								Choose image
								<input
									type="file"
									accept="image/png,image/jpeg,image/gif,image/webp"
									onchange={chooseAvatar}
									class="sr-only"
								/>
							</label>
							{#if avatarUrl || previewUrl}
								<button type="button" onclick={removeAvatar} class="btn-ghost"
									>Remove</button
								>
							{/if}
						</div>
					</div>
					<p class="text-faint mt-2 text-xs">PNG, JPG, GIF or WebP. Maximum 10 MB.</p>
				</div>

				<div>
					<label for="display-name" class="kicker mb-2 block">Display name</label>
					<input
						id="display-name"
						bind:value={name}
						maxlength="50"
						autocomplete="name"
						class="field"
						required
					/>
				</div>

				<div>
					<label for="account-email" class="kicker mb-2 block">Email</label>
					<input
						id="account-email"
						value={user.email}
						class="field text-muted"
						readonly
					/>
					<p class="text-faint mt-2 text-xs">
						Your verified email cannot be changed here.
					</p>
				</div>

				{#if profileError}<p class="text-primary text-sm">{profileError}</p>{/if}
				{#if profileMessage}<p class="text-secondary text-sm">{profileMessage}</p>{/if}
				<button type="submit" disabled={profileSaving} class="btn-primary">
					{profileSaving ? "Saving..." : "Save profile"}
				</button>
			</form>

			<form onsubmit={changePassword} class="border-rule space-y-5 border-t pt-7">
				<div>
					<p class="kicker">Password</p>
					<h2 class="text-ink mt-2 font-serif text-2xl font-medium">Change password</h2>
				</div>
				<div>
					<label for="current-password" class="kicker mb-2 block">Current password</label>
					<input
						id="current-password"
						type="password"
						bind:value={currentPassword}
						autocomplete="current-password"
						class="field"
						required
					/>
				</div>
				<div>
					<label for="new-password" class="kicker mb-2 block">New password</label>
					<input
						id="new-password"
						type="password"
						bind:value={newPassword}
						autocomplete="new-password"
						placeholder="At least 8 characters"
						class="field"
						required
					/>
				</div>
				<div>
					<label for="confirm-password" class="kicker mb-2 block"
						>Confirm new password</label
					>
					<input
						id="confirm-password"
						type="password"
						bind:value={confirmPassword}
						autocomplete="new-password"
						class="field"
						required
					/>
				</div>
				{#if passwordError}<p class="text-primary text-sm">{passwordError}</p>{/if}
				{#if passwordMessage}<p class="text-secondary text-sm">{passwordMessage}</p>{/if}
				<button type="submit" disabled={passwordSaving} class="btn-primary">
					{passwordSaving ? "Changing..." : "Change password"}
				</button>
			</form>
		</div>
	{/if}
</div>
