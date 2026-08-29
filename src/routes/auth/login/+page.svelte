<script lang="ts">
  import { login } from '$lib/stores/auth';
  import { goto } from '$app/navigation';

  let email = $state('');
  let name = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';

    if (!email.trim() || !name.trim()) {
      error = 'Please fill in all fields';
      return;
    }

    if (!email.toLowerCase().endsWith('@deakin.edu.au')) {
      error = 'Only @deakin.edu.au email addresses are allowed';
      return;
    }

    loading = true;
    try {
      await login(email.trim(), name.trim());
      goto('/');
    } catch (err: any) {
      error = err.message ?? 'Login failed. Please try again.';
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
    <h1 class="mt-2 font-serif text-4xl font-medium text-ink">Sign in</h1>
    <p class="mt-2 mb-8 text-[15px] text-muted">Use your Deakin email to contribute.</p>

    <form onsubmit={handleSubmit} class="space-y-5 border-t border-rule pt-8">
      <div>
        <label for="name" class="kicker mb-2 block">Full name</label>
        <input id="name" type="text" bind:value={name} placeholder="Jane Smith" class="field" required />
      </div>

      <div>
        <label for="email" class="kicker mb-2 block">Deakin email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="j.smith@deakin.edu.au"
          class="field"
          required
        />
        <p class="mt-2 text-xs text-faint">Must be an @deakin.edu.au address</p>
      </div>

      {#if error}
        <p class="text-sm text-primary">{error}</p>
      {/if}

      <button type="submit" disabled={loading} class="btn-primary w-full">
        {loading ? 'Signing in...' : 'Sign in / Register'}
      </button>

      <p class="text-xs text-faint">By signing in, you agree that your contributions are public.</p>
    </form>
  </div>
</div>
