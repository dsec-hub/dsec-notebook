<script lang="ts">
	let {
		src,
		name,
		size = "md",
	}: {
		src?: string | null;
		name: string;
		size?: "sm" | "md" | "lg" | "xl";
	} = $props();

	const dimensions = $derived(
		size === "sm"
			? "h-7 w-7"
			: size === "lg"
				? "h-16 w-16"
				: size === "xl"
					? "h-24 w-24"
					: "h-10 w-10",
	);
	const iconSize = $derived(
		size === "sm"
			? "h-4 w-4"
			: size === "lg"
				? "h-8 w-8"
				: size === "xl"
					? "h-12 w-12"
					: "h-5 w-5",
	);
</script>

<div
	class="{dimensions} border-rule bg-rule text-muted inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border"
	role="img"
	aria-label={`${name}'s profile picture`}
>
	{#if src}
		<img {src} alt="" class="h-full w-full object-cover" />
	{:else}
		<svg
			class={iconSize}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"
		>
			<circle cx="12" cy="8" r="4" />
			<path d="M4 21a8 8 0 0 1 16 0" />
		</svg>
	{/if}
</div>
