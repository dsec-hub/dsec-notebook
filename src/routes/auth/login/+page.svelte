<script lang="ts">
	import { goto } from "$app/navigation";
	import { forgotPassword, requestCode, resetPassword, signIn, signUp } from "$lib/stores/auth";

	type Mode = "signin" | "signup" | "forgot";

	let mode = $state<Mode>("signin");
	let email = $state("");
	let name = $state("");
	let code = $state("");
	let password = $state("");
	let sent = $state(false);
	let error = $state("");
	let loading = $state(false);

	const isDeakin = (value: string) => value.toLowerCase().endsWith("@deakin.edu.au");

	function switchMode(next: Mode) {
		mode = next;
		email = "";
		name = "";
		code = "";
		password = "";
		sent = false;
		error = "";
	}

	function goBack() {
		sent = false;
		code = "";
		password = "";
		error = "";
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = "";

		if (mode === "signin") {
			if (!email.trim() || !password) {
				error = "Please enter your email and password";
				return;
			}
			loading = true;
			try {
				await signIn(email.trim(), password);
				goto("/");
			} catch (err: any) {
				error = err.message ?? "Sign in failed. Please try again.";
			} finally {
				loading = false;
			}
			return;
		}

		if (mode === "signup") {
			if (!sent) {
				if (!name.trim() || !email.trim()) {
					error = "Please fill in all fields";
					return;
				}
				if (!isDeakin(email)) {
					error = "Only @deakin.edu.au email addresses are allowed";
					return;
				}
				loading = true;
				try {
					await requestCode(email.trim(), name.trim());
					sent = true;
				} catch (err: any) {
					error = err.message ?? "Failed to send the code. Please try again.";
				} finally {
					loading = false;
				}
				return;
			}

			if (!code.trim()) {
				error = "Please enter the verification code";
				return;
			}
			if (password.length < 8) {
				error = "Password must be at least 8 characters";
				return;
			}
			loading = true;
			try {
				await signUp(email.trim(), code.trim(), password);
				goto("/");
			} catch (err: any) {
				error = err.message ?? "Failed to create your account. Please try again.";
			} finally {
				loading = false;
			}
			return;
		}

		// forgot
		if (!sent) {
			if (!email.trim()) {
				error = "Please enter your Deakin email";
				return;
			}
			if (!isDeakin(email)) {
				error = "Only @deakin.edu.au email addresses are allowed";
				return;
			}
			loading = true;
			try {
				await forgotPassword(email.trim());
				sent = true;
			} catch (err: any) {
				error = err.message ?? "Failed to send the code. Please try again.";
			} finally {
				loading = false;
			}
			return;
		}

		if (!code.trim()) {
			error = "Please enter the reset code";
			return;
		}
		if (password.length < 8) {
			error = "Password must be at least 8 characters";
			return;
		}
		loading = true;
		try {
			await resetPassword(email.trim(), code.trim(), password);
			goto("/");
		} catch (err: any) {
			error = err.message ?? "Failed to reset your password. Please try again.";
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign in — Notebook</title>
</svelte:head>

<div class="page flex min-h-[calc(100vh-220px)] items-center">
	<div class="mx-auto w-full max-w-md">
		<p class="kicker">Account</p>
		<h1 class="text-ink mt-2 font-serif text-4xl font-medium">
			{mode === "signin"
				? "Sign in"
				: mode === "signup"
					? "Create account"
					: "Reset password"}
		</h1>
		<p class="text-muted mt-2 mb-8 text-[15px]">Use your Deakin email to contribute.</p>

		{#if mode === "signin"}
			<form onsubmit={handleSubmit} class="border-rule space-y-5 border-t pt-8">
				<div>
					<label for="email" class="kicker mb-2 block">Deakin email</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						placeholder="@deakin.edu.au"
						autocomplete="email"
						class="field"
						required
					/>
				</div>

				<div>
					<label for="password" class="kicker mb-2 block">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="Your password"
						autocomplete="current-password"
						class="field"
						required
					/>
				</div>

				{#if error}
					<p class="text-primary text-sm">{error}</p>
				{/if}

				<button type="submit" disabled={loading} class="btn-primary w-full">
					{loading ? "Signing in..." : "Sign in"}
				</button>

				<div class="flex items-center justify-between text-sm">
					<button
						type="button"
						onclick={() => switchMode("forgot")}
						class="text-muted hover:text-ink"
					>
						Forgot password?
					</button>
					<button
						type="button"
						onclick={() => switchMode("signup")}
						class="text-muted hover:text-ink"
					>
						Create account
					</button>
				</div>
			</form>
		{:else if mode === "signup"}
			{#if !sent}
				<form onsubmit={handleSubmit} class="border-rule space-y-5 border-t pt-8">
					<div>
						<label for="name" class="kicker mb-2 block">Full name</label>
						<input
							id="name"
							type="text"
							bind:value={name}
							placeholder="Enter your name"
							class="field"
							required
						/>
					</div>

					<div>
						<label for="email" class="kicker mb-2 block">Deakin email</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="@deakin.edu.au"
							class="field"
							required
						/>
						<p class="text-faint mt-2 text-xs">Must be an @deakin.edu.au address</p>
					</div>

					{#if error}
						<p class="text-primary text-sm">{error}</p>
					{/if}

					<button type="submit" disabled={loading} class="btn-primary w-full">
						{loading ? "Sending code..." : "Send verification code"}
					</button>

					<button
						type="button"
						onclick={() => switchMode("signin")}
						class="text-muted hover:text-ink text-sm"
					>
						Already have an account? Sign in
					</button>
				</form>
			{:else}
				<form onsubmit={handleSubmit} class="border-rule space-y-5 border-t pt-8">
					<p class="text-muted text-sm">
						We sent a 6-digit code to <span class="text-ink">{email}</span>. It expires
						in 10 minutes.
					</p>

					<div>
						<label for="code" class="kicker mb-2 block">Verification code</label>
						<input
							id="code"
							type="text"
							inputmode="numeric"
							maxlength="6"
							autocomplete="one-time-code"
							bind:value={code}
							placeholder="000000"
							class="field"
							required
						/>
					</div>

					<div>
						<label for="password" class="kicker mb-2 block">Create password</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							placeholder="At least 8 characters"
							autocomplete="new-password"
							class="field"
							required
						/>
					</div>

					{#if error}
						<p class="text-primary text-sm">{error}</p>
					{/if}

					<button type="submit" disabled={loading} class="btn-primary w-full">
						{loading ? "Creating account..." : "Create account"}
					</button>

					<button
						type="button"
						onclick={goBack}
						class="text-muted hover:text-ink text-sm"
					>
						Use a different email
					</button>
				</form>
			{/if}
		{:else}
			{#if !sent}
				<form onsubmit={handleSubmit} class="border-rule space-y-5 border-t pt-8">
					<div>
						<label for="email" class="kicker mb-2 block">Deakin email</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							placeholder="@deakin.edu.au"
							autocomplete="email"
							class="field"
							required
						/>
						<p class="text-faint mt-2 text-xs">
							We'll email a reset code to your @deakin.edu.au address.
						</p>
					</div>

					{#if error}
						<p class="text-primary text-sm">{error}</p>
					{/if}

					<button type="submit" disabled={loading} class="btn-primary w-full">
						{loading ? "Sending code..." : "Send reset code"}
					</button>

					<button
						type="button"
						onclick={() => switchMode("signin")}
						class="text-muted hover:text-ink text-sm"
					>
						Back to sign in
					</button>
				</form>
			{:else}
				<form onsubmit={handleSubmit} class="border-rule space-y-5 border-t pt-8">
					<p class="text-muted text-sm">
						We sent a 6-digit code to <span class="text-ink">{email}</span>. It expires
						in 10 minutes.
					</p>

					<div>
						<label for="code" class="kicker mb-2 block">Reset code</label>
						<input
							id="code"
							type="text"
							inputmode="numeric"
							maxlength="6"
							autocomplete="one-time-code"
							bind:value={code}
							placeholder="000000"
							class="field"
							required
						/>
					</div>

					<div>
						<label for="password" class="kicker mb-2 block">New password</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							placeholder="At least 8 characters"
							autocomplete="new-password"
							class="field"
							required
						/>
					</div>

					{#if error}
						<p class="text-primary text-sm">{error}</p>
					{/if}

					<button type="submit" disabled={loading} class="btn-primary w-full">
						{loading ? "Resetting..." : "Reset password"}
					</button>

					<button
						type="button"
						onclick={goBack}
						class="text-muted hover:text-ink text-sm"
					>
						Use a different email
					</button>
				</form>
			{/if}
		{/if}
	</div>
</div>
