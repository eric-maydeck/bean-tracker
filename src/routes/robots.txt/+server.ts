// Filter-combo URLs (?...) are endless crawler bait and each costs a server render. Link-preview bots
// fetch one shared URL at a time (share links are `?...`), so they get their own group and may read all.
const PREVIEW_BOTS = ['Twitterbot', 'Slackbot', 'Slackbot-LinkExpanding', 'Discordbot', 'facebookexternalhit',
  'LinkedInBot', 'TelegramBot', 'WhatsApp'];

export const GET = () =>
  new Response(
    `${PREVIEW_BOTS.map((b) => `User-agent: ${b}`).join('\n')}\nAllow: /\n\nUser-agent: *\nDisallow: /*?\nDisallow: /api/\nAllow: /\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } }
  );
