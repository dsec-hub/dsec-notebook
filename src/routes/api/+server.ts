import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { call } from '$lib/server/api';

export const POST: RequestHandler = async ({ request }) => {
  let fn: string;
  let args: Record<string, unknown>;

  try {
    const body = await request.json();
    fn = String(body?.fn ?? '');
    args = (body?.args ?? {}) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const result = call(fn, args as Record<string, any>);
    return json({ ok: true, result });
  } catch (err: any) {
    const message = err?.message ?? 'Internal error';
    const status = message === 'Not authenticated' || message === 'Not authorized' ? 401 : 400;
    return json({ ok: false, error: message }, { status });
  }
};
