import type { APIRoute } from 'astro';
import { getAuthUrl } from '../../../../lib/googleFit';

export const GET: APIRoute = () => {
  if (!process.env['GOOGLE_CLIENT_ID'] || !process.env['GOOGLE_CLIENT_SECRET']) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/?google_auth=not_configured' },
    });
  }
  const url = getAuthUrl();
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
};
