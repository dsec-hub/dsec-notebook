import { writable } from "svelte/store";
import { query, mutation } from "$lib/api";
import type { UserDoc } from "$lib/types";

export const currentUser = writable<UserDoc | null>(null);
export const isAuthenticated = writable(false);

const STORAGE_KEY = "dsec_session";

export async function initAuth() {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		try {
			const { token } = JSON.parse(stored);
			const user = await query("users:getByToken", { token });
			if (user) {
				currentUser.set(user as UserDoc);
				isAuthenticated.set(true);
			} else {
				localStorage.removeItem(STORAGE_KEY);
			}
		} catch {
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

function setSession(result: { userId: string; token: string; name: string }, email: string) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: result.token }));
	currentUser.set({
		_id: result.userId,
		email: email.toLowerCase(),
		name: result.name,
		sessionToken: result.token,
		_creationTime: Date.now(),
	} as UserDoc);
	isAuthenticated.set(true);
	return result;
}

export async function requestCode(email: string, name: string) {
	return await mutation("auth:requestCode", { email, name });
}

export async function signUp(email: string, code: string, password: string) {
	const result = await mutation("auth:signup", { email, code, password });
	return setSession(result, email);
}

export async function signIn(email: string, password: string) {
	const result = await mutation("auth:signin", { email, password });
	return setSession(result, email);
}

export async function forgotPassword(email: string) {
	return await mutation("auth:forgotPassword", { email });
}

export async function resetPassword(email: string, code: string, password: string) {
	const result = await mutation("auth:resetPassword", { email, code, password });
	return setSession(result, email);
}

export function getToken(): string | null {
	const stored = localStorage.getItem(STORAGE_KEY);
	if (!stored) return null;
	try {
		return JSON.parse(stored).token;
	} catch {
		return null;
	}
}

export function logout() {
	localStorage.removeItem(STORAGE_KEY);
	currentUser.set(null);
	isAuthenticated.set(false);
}
