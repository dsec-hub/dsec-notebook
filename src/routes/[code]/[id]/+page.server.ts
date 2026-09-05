import { loadPostSeo } from "$lib/server/pageSeo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ params }) => loadPostSeo(params.id, params.code);
