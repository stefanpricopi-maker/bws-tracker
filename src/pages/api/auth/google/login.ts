import type { APIRoute } from 'astro';
import { getAuthUrl } from '../../../../lib/googleFit';

export const GET: APIRoute = () => {
  const url = getAuthUrl();
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
};
