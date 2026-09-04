<script lang="ts">
	import { renderMarkdown } from "$lib/markdown";

	let { content }: { content: string } = $props();

	const copiedTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

	function codeCopy(node: HTMLElement) {
		async function onClick(event: MouseEvent) {
			const button = (event.target as HTMLElement | null)?.closest?.("button.code-copy");
			if (!(button instanceof HTMLButtonElement)) return;

			const code = button.closest("pre")?.querySelector("code");
			const text = code?.textContent ?? "";
			if (!text) return;

			try {
				await navigator.clipboard.writeText(text);
			} catch {
				return;
			}

			button.classList.add("copied");
			button.setAttribute("aria-label", "Copied");
			button.setAttribute("title", "Copied");

			const previous = copiedTimers.get(button);
			if (previous) clearTimeout(previous);
			copiedTimers.set(
				button,
				setTimeout(() => {
					button.classList.remove("copied");
					button.setAttribute("aria-label", "Copy code");
					button.setAttribute("title", "Copy");
				}, 1600),
			);
		}

		node.addEventListener("click", onClick);
		return {
			destroy() {
				node.removeEventListener("click", onClick);
			},
		};
	}
</script>

<div class="markdown" use:codeCopy>{@html renderMarkdown(content)}</div>
