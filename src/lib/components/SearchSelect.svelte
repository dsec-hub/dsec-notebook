<script lang="ts">
	import { tick } from "svelte";

	type SearchSelectOption = {
		value: string;
		label: string;
		searchText?: string;
	};

	let {
		id,
		value = $bindable(""),
		options,
		placeholder = "Select...",
		searchPlaceholder = "Search...",
		emptyMessage = "No matches",
	}: {
		id: string;
		value?: string;
		options: SearchSelectOption[];
		placeholder?: string;
		searchPlaceholder?: string;
		emptyMessage?: string;
	} = $props();

	let open = $state(false);
	let query = $state("");
	let highlight = $state(0);
	let searchInput: HTMLInputElement | undefined = $state();
	let listEl: HTMLDivElement | undefined = $state();

	const selected = $derived(options.find((option) => option.value === value));
	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return options;
		return options.filter((option) => {
			const haystack = (option.searchText ?? option.label).toLowerCase();
			return haystack.includes(q);
		});
	});

	async function openMenu() {
		open = true;
		query = "";
		await tick();
		const selectedIndex = filtered.findIndex((option) => option.value === value);
		highlight = selectedIndex >= 0 ? selectedIndex : 0;
		searchInput?.focus();
	}

	function closeMenu() {
		open = false;
		query = "";
	}

	function choose(optionValue: string) {
		value = optionValue;
		closeMenu();
	}

	function moveHighlight(delta: number) {
		if (filtered.length === 0) return;
		if (highlight < 0 || highlight >= filtered.length) {
			highlight = delta > 0 ? 0 : filtered.length - 1;
		} else {
			highlight = (highlight + delta + filtered.length) % filtered.length;
		}
		const item = listEl?.children[highlight + 1] as HTMLElement | undefined;
		item?.scrollIntoView({ block: "nearest" });
	}

	function onSearchKeydown(event: KeyboardEvent) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			moveHighlight(1);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			moveHighlight(-1);
		} else if (event.key === "Enter") {
			event.preventDefault();
			const option = filtered[highlight];
			if (option) choose(option.value);
		} else if (event.key === "Escape") {
			event.preventDefault();
			closeMenu();
		}
	}
</script>

<div class="relative">
	<button
		{id}
		type="button"
		class="border-rule text-ink focus:border-primary bg-surface flex w-full items-center justify-between gap-2 rounded-sm border px-3 py-2.5 text-left text-sm transition-colors outline-none"
		aria-haspopup="listbox"
		aria-expanded={open}
		onclick={() => (open ? closeMenu() : openMenu())}
	>
		<span class="min-w-0 flex-1 truncate {selected ? '' : 'text-faint'}"
			>{selected?.label ?? placeholder}</span
		>
		<svg
			class="text-muted h-3.5 w-3.5 shrink-0 transition-transform {open ? 'rotate-180' : ''}"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="1.5"
			aria-hidden="true"
		>
			<path stroke-linecap="square" d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-10 cursor-default"
			aria-label="Close menu"
			onclick={closeMenu}
		></button>
		<div
			class="border-rule bg-surface absolute z-20 mt-1 w-full overflow-hidden rounded-sm border shadow-lg"
		>
			<div class="border-rule border-b p-1.5">
				<input
					bind:this={searchInput}
					type="search"
					bind:value={query}
					placeholder={searchPlaceholder}
					aria-label={searchPlaceholder}
					class="field py-1.5 text-sm"
					onkeydown={onSearchKeydown}
					oninput={() => (highlight = 0)}
				/>
			</div>
			<div bind:this={listEl} role="listbox" class="max-h-56 overflow-y-auto py-1">
				<button
					type="button"
					role="option"
					aria-selected={value === ""}
					class="block w-full px-3 py-2 text-left text-sm {value === ''
						? 'text-primary'
						: 'text-muted hover:text-ink'}"
					onmouseenter={() => (highlight = -1)}
					onclick={() => choose("")}
				>
					{placeholder}
				</button>
				{#each filtered as option, index (option.value)}
					<button
						type="button"
						role="option"
						aria-selected={option.value === value}
						class="block w-full px-3 py-2 text-left text-sm {index === highlight ||
						option.value === value
							? 'text-primary'
							: 'text-ink hover:text-primary'}"
						onmouseenter={() => (highlight = index)}
						onclick={() => choose(option.value)}
					>
						{option.label}
					</button>
				{/each}
				{#if filtered.length === 0}
					<p class="text-muted px-3 py-2 text-sm">{emptyMessage}</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
