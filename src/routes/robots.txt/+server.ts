// Filter-combo URLs (?...) are endless crawler bait and each costs a server render.
export const GET = () =>
  new Response('User-agent: *\nDisallow: /*?\nDisallow: /api/\nAllow: /\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  });
