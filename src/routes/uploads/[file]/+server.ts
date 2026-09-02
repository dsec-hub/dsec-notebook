import type { RequestHandler } from "./$types";
import { getImage } from "$lib/server/images";

export const GET: RequestHandler = ({ params }) => {
	const image = getImage(params.file);
	if (!image) return new Response("Not found", { status: 404 });
	return new Response(image.buffer, {
		headers: {
			"Content-Type": image.mime,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
};
