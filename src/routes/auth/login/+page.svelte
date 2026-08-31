<script lang="ts">
	import { requestCode, verifyCode } from "$lib/stores/auth";
	import { goto } from "$app/navigation";

	let step = $state<"email" | "code">("email");
	let email = $state("");
	let name = $state("");
	let code = $state("");
	let error = $state("");
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = "";

		if (step === "email") {
			if (!email.trim() || !name.trim()) {
				error = "Please fill in all fields";
				return;
			}

			if (!email.toLowerCase().endsWith("@deakin.edu.au")) {
				error = "Only @deakin.edu.au email addresses are allowed";
				return;
			}

			loading = true;
			try {
				await requestCode(email.trim(), name.trim());
				step = "code";
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

		loading = true;
		try {
			await verifyCode(email.trim(), code.trim());
			goto("/");
		} catch (err: any) {
			error = err.message ?? "Verification failed. Please try again.";
		} finally {
			loading = false;
		}
	}

	function goBack() {
		step = "email";
		code = "";
		error = "";
	}
</script>

<svelte:head>
	<title>Sign in — Notebook</title>
</svelte:head>

<div class="page flex min-h-[calc(100vh-220px)] items-center">
	<div class="mx-auto w-full max-w-md">
		<p class="kicker">Account</p>
		<h1 class="text-ink mt-2 font-serif text-4xl font-medium">Sign in</h1>
		<p class="text-muted mt-2 mb-8 text-[15px]">Use your Deakin email to contribute.</p>

		{#if step === "email"}
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

				<p class="text-faint text-xs">
					By signing in, you agree that your contributions are public.
				</p>
			</form>
		{:else}
			<form onsubmit={handleSubmit} class="border-rule space-y-5 border-t pt-8">
				<p class="text-muted text-sm">
					We sent a 6-digit code to <span class="text-ink">{email}</span>. It expires in
					10 minutes.
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

				{#if error}
					<p class="text-primary text-sm">{error}</p>
				{/if}

				<button type="submit" disabled={loading} class="btn-primary w-full">
					{loading ? "Verifying..." : "Verify & sign in"}
				</button>

				<button type="button" onclick={goBack} class="text-muted hover:text-ink text-sm">
					Use a different email
				</button>
			</form>
		{/if}
	</div>
</div>
