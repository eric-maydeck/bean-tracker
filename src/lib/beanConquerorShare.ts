import protobuf from 'protobufjs';
// `?raw` (a Vite-specific import suffix) inlines the .proto file's text
// content at build/transform time, identically in every execution
// context (browser dev/prod, SSR, and the Node-based vitest run below).
// The brief's originally-specified `?url` + `protobuf.load(url)` pairing
// resolves to a browser-relative path (e.g. "/src/lib/beanconquerorBean.proto")
// that doesn't exist as a filesystem path, so it fails with ENOENT when
// run in Node (this file's own test, and any SSR context) — `protobuf.load`
// only knows how to `fetch()` a URL in a real browser. Parsing the raw
// source with `protobuf.parse()` sidesteps that entirely: no runtime
// fetch or filesystem access needed in any environment.
import protoSource from './beanconquerorBean.proto?raw';
import type { CoffeeRow, RoastLevelRow } from './types';

// protobufjs defaults to two behaviors that don't match Bean Conqueror's
// real field names and this module's test expectations:
//  1. It camelCases .proto field names for the JS message API (so the
//     schema's `roast_range`/`bean_information`/`external_images` would
//     surface as `roastRange`/`beanInformation`/`externalImages`).
//     `parse.defaults.keepCase = true` is protobufjs's own documented
//     mutable-defaults hook for overriding this globally — it's honored
//     by any `protobuf.load()`/`protobuf.parse()` call in this process
//     that doesn't pass its own options, including the ones in this
//     module's test file, which re-parses the .proto independently to
//     verify the wire bytes.
//  2. It decodes 64-bit integer fields (this schema's `roast_range`,
//     `Config.unix_timestamp`) as `Long` instances from the `long`
//     package rather than plain numbers. Setting `util.Long = null` and
//     reconfiguring is protobufjs's documented way to opt out, trading
//     precision above 2^53 (irrelevant for a roast-range integer) for
//     plain JS numbers that compare equal to literals like `3`.
// `parse.defaults` exists at runtime (referenced in protobufjs's own
// JSDoc as the fallback used whenever a `parse()`/`load()` call omits
// its options argument) but isn't part of the published .d.ts, hence
// the cast.
(protobuf.parse as unknown as { defaults: protobuf.IParseOptions }).defaults.keepCase = true;
protobuf.util.Long = null as unknown as typeof protobuf.util.Long;
protobuf.configure();

let cachedRoot: protobuf.Root | null = null;

function loadRoot(): protobuf.Root {
  if (cachedRoot) return cachedRoot;
  cachedRoot = protobuf.parse(protoSource).root;
  return cachedRoot;
}

// Bean Conqueror's own in-app roast slider (ion-range, step="0.5", max="5")
// genuinely supports half-steps in its live data model — but the shipped
// share/QR wire format (roast_range in bean.proto) is a uint64, whole
// numbers only, confirmed against Bean Conqueror's real master-branch
// source. A half-step roast level (this app's own Hyperlight/Nordic
// Light/Light/Medium-Dark, at .5/.5/2.5/4.5) can never survive the share
// exactly — Math.floor (not round) per the user's explicit preference
// after testing live: a "Light" (2.5) bean showing as Bean Conqueror's "3"
// read as visibly darker than intended, so rounding toward the lighter
// whole number is the less-wrong direction for this app's own use.
function degreeOfRoastFor(roastLevel: string | null, roastLevels: RoastLevelRow[]): number {
  if (!roastLevel) return 0;
  const match = roastLevels.find((r) => r.roast_level === roastLevel);
  return match ? Math.floor(match.degrees_of_roast) : 0;
}

// `Buffer` isn't defined in the browser — it's a Node global that
// SvelteKit doesn't polyfill for client code, confirmed via a live click
// of the "Send to Bean Conqueror" button (`ReferenceError: Buffer is not
// defined` at this call site). `buildShareUrl` is only ever invoked from
// this browser-only click handler (see +page.svelte), so it needs a
// `Buffer`-free base64 encoder. `btoa`/`Uint8Array` are available in both
// the browser and in Node (this module's own test), so this works
// everywhere without an SSR-specific code path.
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function buildShareUrl(coffee: CoffeeRow, roastLevels: RoastLevelRow[]): Promise<string> {
  const root = loadRoot();
  const BeanProto = root.lookupType('beanconqueror.BeanProto');

  const message = BeanProto.create({
    name: coffee.coffee_name,
    roaster: coffee.roaster ?? undefined,
    roastingDate: coffee.roast_date ?? undefined,
    // Rounded because Bean Conqueror's shipped schema carries weight/cost as
    // uint64 varints (whole numbers only) — a real constraint of their app,
    // not a limitation of ours; protobufjs would otherwise truncate or reject
    // a fractional value here.
    weight: coffee.amount_g != null ? Math.round(coffee.amount_g) : undefined,
    cost: coffee.cost != null ? Math.round(coffee.cost) : undefined,
    decaffeinated: coffee.decaf === 1,
    // BeanMix: BLEND (2) when the name says so, else SINGLE_ORIGIN (1).
    beanMix: /blend/i.test(coffee.coffee_name) ? 2 : 1,
    roast_range: degreeOfRoastFor(coffee.roast_level, roastLevels),
    // Always Filter (BeanRoastingType.FILTER): every coffee here is brewed as filter.
    bean_roasting_type: 1,
    bean_information: [
      {
        country: coffee.origin ?? undefined,
        processing: coffee.processing ?? undefined
      }
    ]
  });

  const bytes = BeanProto.encode(message).finish();
  const base64 = bytesToBase64(bytes);

  const chunkSize = 400;
  const params: string[] = [];
  for (let i = 0, chunkIndex = 0; i < base64.length; i += chunkSize, chunkIndex++) {
    params.push(`shareUserBean${chunkIndex}=${base64.slice(i, i + chunkSize)}`);
  }

  return `https://beanconqueror.com?${params.join('&')}`;
}
