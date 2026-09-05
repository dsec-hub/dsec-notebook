/// <reference types="vite-plugin-pwa/client" />

export {};

declare global {
	namespace App {
		interface PageData {
			seo?: import("$lib/seo").PageSeo;
		}
		interface PageState {}
		interface Platform {}
	}
}
