import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const vars = {
    DATABASE_URL:          present(process.env['DATABASE_URL']),
    DATABASE_AUTH_TOKEN:   present(process.env['DATABASE_AUTH_TOKEN']),
    GOOGLE_CLIENT_ID:      present(process.env['GOOGLE_CLIENT_ID']),
    GOOGLE_CLIENT_SECRET:  present(process.env['GOOGLE_CLIENT_SECRET']),
    GOOGLE_REDIRECT_URI:   process.env['GOOGLE_REDIRECT_URI'] ?? '(not set)',
    AI_API_KEY:            present(process.env['AI_API_KEY']),
    AI_API_BASE_URL:       process.env['AI_API_BASE_URL'] ?? '(not set)',
    AI_MODEL:              process.env['AI_MODEL'] ?? '(not set)',
  };

  return new Response(JSON.stringify(vars, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

function present(val: string | undefined): string {
  if (!val) return '❌ missing';
  return `✅ set (${val.length} chars)`;
}
