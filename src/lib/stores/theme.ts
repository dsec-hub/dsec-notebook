import { get, writable } from "svelte/store";

export type Theme = "light" | "dark";

const STORAGE_KEY = "dsec_theme";

function getInitialTheme(): Theme {
	if (typeof window === "undefined") return "light";
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === "light" || stored === "dark") return stored;
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const theme = writable<Theme>(getInitialTheme());

function applyTheme(value: Theme) {
	const root = document.documentElement;
	root.classList.toggle("dark", value === "dark");
	root.style.colorScheme = value;
}

export function toggleTheme() {
	const next: Theme = get(theme) === "dark" ? "light" : "dark";
	localStorage.setItem(STORAGE_KEY, next);
	theme.set(next);
	applyTheme(next);
}
