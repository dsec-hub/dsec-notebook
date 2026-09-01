<script lang="ts">
	import { renderMarkdown } from "$lib/markdown";

	let { content }: { content: string } = $props();
</script>

<div class="markdown">{@html renderMarkdown(content)}</div>
