<script lang="ts">
	let {
		url,
		title,
	}: {
		url?: string;
		title?: string;
	} = $props();

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	function absoluteUrl(href: string) {
		return new URL(href, window.location.origin).href;
	}

	async function share(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		const href = absoluteUrl(url ?? window.location.href);
		try {
			if (navigator.share) {
				await navigator.share({ title, url: href });
				return;
			}
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") return;
		}

		try {
			await navigator.clipboard.writeText(href);
			copied = true;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = false), 1500);
		} catch {
			/* ignore */
		}
	}
</script>

<button
	type="button"
	onclick={share}
	class="text-faint hover:text-primary hover:bg-rule -ml-1 inline-flex h-7 w-7 items-center justify-center rounded-sm transition-colors"
	aria-label={copied ? "Link copied" : "Share"}
	title={copied ? "Copied" : "Share"}
>
	{#if copied}
		<svg
			class="h-3.5 w-3.5"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.75"
			aria-hidden="true"
		>
			<path d="M5 13l4 4L19 7" stroke-linecap="square" />
		</svg>
	{:else}
		<svg class="h-3.5 w-3.5" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
			<path
				d="M512,241.7L273.643,3.343v156.152c-71.41,3.744-138.015,33.337-188.958,84.28C30.075,298.384,0,370.991,0,448.222v60.436l29.069-52.985c45.354-82.671,132.173-134.027,226.573-134.027c5.986,0,12.004,0.212,18.001,0.632v157.779L512,241.7z M255.642,290.666c-84.543,0-163.661,36.792-217.939,98.885c26.634-114.177,129.256-199.483,251.429-199.483h15.489V78.131l163.568,163.568L304.621,405.267V294.531l-13.585-1.683C279.347,291.401,267.439,290.666,255.642,290.666z"
			/>
		</svg>
	{/if}
</button>
