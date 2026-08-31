/// <reference types="vite-plugin-pwa/client" />

export {};

declare global {
	namespace App {
		interface PageData {}
		interface PageState {}
		interface Platform {}
	}
}
