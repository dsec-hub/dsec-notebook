import { loadUnitSeo } from "$lib/server/pageSeo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => loadUnitSeo(params.code);
