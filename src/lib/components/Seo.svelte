<script lang="ts">
	import type { PageSeo } from "$lib/seo";

	let { seo }: { seo: PageSeo | undefined } = $props();
</script>

<svelte:head>
	{#if seo}
		<title>{seo.title}</title>
		<meta name="description" content={seo.description} />
		<meta property="og:title" content={seo.title} />
		<meta property="og:description" content={seo.description} />
	{/if}
</svelte:head>
