## [1.110.5](https://github.com/eric-maydeck/bean-tracker/compare/v1.110.4...v1.110.5) (2026-11-08)


### Bug Fixes

* **deps:** override fflate 0.7.5 and uuid 11.1.1 for open advisories ([9c00de0](https://github.com/eric-maydeck/bean-tracker/commit/9c00de0ce78f541257c2cbd10834b6a0530048dd))
* **stats:** count dashed chart segments after every draw (chart.js 4.6 skips onComplete on update) ([55ea096](https://github.com/eric-maydeck/bean-tracker/commit/55ea0969189625c5fd120865f7b0d54bcfc8a2d4))

## [1.110.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.110.3...v1.110.4) (2026-11-08)


## [1.110.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.110.2...v1.110.3) (2026-11-08)


## [1.110.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.110.1...v1.110.2) (2026-11-08)


## [1.110.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.110.0...v1.110.1) (2026-11-08)


### Bug Fixes

* **auth:** async scrypt verify and a global failed-login cap ([f6cce64](https://github.com/eric-maydeck/bean-tracker/commit/f6cce641a9c519519dc0e15bc65bc37322fa33c3))
* **auth:** reserve login attempts before verifying; cap concurrent checks ([476554f](https://github.com/eric-maydeck/bean-tracker/commit/476554f9b777fe330d8e4df21c29a5708dcf38b4))
* **recaps:** 404 unknown card slides before building the recap ([e0ed099](https://github.com/eric-maydeck/bean-tracker/commit/e0ed099abc307f296aa1b43cc1fe56773d96b897))
* **security:** answer oversized anonymous form actions with an ActionResult ([77cb25f](https://github.com/eric-maydeck/bean-tracker/commit/77cb25f7070a94932a806f089856109b0c1619d6))
* **security:** require Origin on all mutating requests, cap anonymous bodies, add security headers ([06481f3](https://github.com/eric-maydeck/bean-tracker/commit/06481f33750c2325cfadfd12024c21f7984318fa))
* **share:** rate-limit short-link creation per IP ([ea3013f](https://github.com/eric-maydeck/bean-tracker/commit/ea3013f7bc07f44220b215f143510414e10da8c7))

# [1.110.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.109.0...v1.110.0) (2026-11-07)


### Bug Fixes

* **recaps:** hour chart axis labels keep 3 bars from the end labels ([6249de0](https://github.com/eric-maydeck/bean-tracker/commit/6249de05d29d9397bf7e409cf912772295459ab3))


### Features

* **config:** contact email and owner name come from config hosts ([3cf71a7](https://github.com/eric-maydeck/bean-tracker/commit/3cf71a7bb5520493b6b2875af2a9739b0a6a69de))
* **config:** optional config.yaml with per-host site identity ([f9ab73f](https://github.com/eric-maydeck/bean-tracker/commit/f9ab73f6887731dbf01be829669c2589cb6097d4))

# [1.109.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.108.0...v1.109.0) (2026-11-06)


### Bug Fixes

* **account:** file name takes the free width of the upload row ([8e97999](https://github.com/eric-maydeck/bean-tracker/commit/8e9799939fc62951ad26b8c041d1e40a1bb17939))
* **account:** household under bean conqueror, no-file label, style people link ([25b4580](https://github.com/eric-maydeck/bean-tracker/commit/25b4580101b4b968b277098a04c83129f84adae8))
* **account:** keep the picked file after a failed bq import ([e9d507d](https://github.com/eric-maydeck/bean-tracker/commit/e9d507d2e00366c7d1238f17cb65341c4615e7b3))
* **account:** link the household setting from the people switch; update save and perf specs ([55f36b6](https://github.com/eric-maydeck/bean-tracker/commit/55f36b601dcfa3c63dfe3a001165cf7cffb41dbb))
* **account:** name the noun in updated-only import summary lines ([896717f](https://github.com/eric-maydeck/bean-tracker/commit/896717f7cea4674867768a5b6b51c0effb6c224e))
* **account:** say no roast date in the not-yet-tracked meta line ([0306454](https://github.com/eric-maydeck/bean-tracker/commit/0306454f482fd72f5fb554bd0595884d5295a4b6))
* **account:** show a failed link in the triage row; tidy stats imports ([ae528e5](https://github.com/eric-maydeck/bean-tracker/commit/ae528e514a39fe8e87b1567879c624da7ef74f87))
* **account:** show only import errors under the upload ([b519c3f](https://github.com/eric-maydeck/bean-tracker/commit/b519c3f6f6477423f64f8c0a3cd12d47d259a217))
* **account:** stats panel joins the right column; tokyo test reads the footer stamp ([3dc65dd](https://github.com/eric-maydeck/bean-tracker/commit/3dc65dd55cd7357d5d583eeedcf3d44857e67eae))
* **account:** untracked note counts the rows shown ([48b9cbc](https://github.com/eric-maydeck/bean-tracker/commit/48b9cbc9c88164a927af2279f3df9c48a42825c7))
* **account:** wrap long badges in the panel; show nothing changed as a plain line ([e735684](https://github.com/eric-maydeck/bean-tracker/commit/e735684e1f4feea2748b6ad1bd594fd841629aea))
* **charts:** sticky-link bar charts keep tips on the mark, each segment has its own link ([a80e38c](https://github.com/eric-maydeck/bean-tracker/commit/a80e38cda92787a039a556e364f55d55bb68d2e8))
* **coffees:** filter editor list keeps a minimum height on short screens ([9f1e5f6](https://github.com/eric-maydeck/bean-tracker/commit/9f1e5f6ac9b4d9a7ab78ce134773411972a58838))
* **coffees:** filter list shows the draft, half-edited column keeps apply off, focus returns ([92ffe11](https://github.com/eric-maydeck/bean-tracker/commit/92ffe1121130ef9486b2289a5a7ac4869f80bfc6))
* **coffee:** vs like coffees compares within the coffee's own kind ([9c3d1b1](https://github.com/eric-maydeck/bean-tracker/commit/9c3d1b1388442a80247f31c7dba34286ba919fde))
* **insights:** caffeine board fills its row, decaf note only when it hides ratings ([0fd7c1e](https://github.com/eric-maydeck/bean-tracker/commit/0fd7c1e3771842d71f576c718747f11d105ab8d3))
* **insights:** caffeine chart sized to its two lines, 200px ([8ba5e49](https://github.com/eric-maydeck/bean-tracker/commit/8ba5e49710914951133416aa9443e606d1944e2d))
* **insights:** count 12 boards in layout states, no expand on the full-row caffeine card ([ba5f26c](https://github.com/eric-maydeck/bean-tracker/commit/ba5f26cb8b33031f9e8c5ba5c488e46528613453))
* **insights:** drop dead caffeine card branches, stale low/open, noise note and import ([5911d3c](https://github.com/eric-maydeck/bean-tracker/commit/5911d3c2d2555bf6df04d5bc8a554d6c24223b67))
* **insights:** drop the What's waiting height hold on resize ([fb42903](https://github.com/eric-maydeck/bean-tracker/commit/fb4290314dcdc7ef5bc13b01ba74cd9072b59337))
* **insights:** findings headline keeps its own tip; chart-line hit test expects nearest x ([9f3543e](https://github.com/eric-maydeck/bean-tracker/commit/9f3543edc8f876277580f61da9f411019be9bb45))
* **insights:** five-option chart toggle fits a 360px card ([0938f31](https://github.com/eric-maydeck/bean-tracker/commit/0938f311e1fdffec6615ce520c4e66e14ea52b57))
* **insights:** no footer spacer under the Caffeine board ([95e403e](https://github.com/eric-maydeck/bean-tracker/commit/95e403ed00c3653ea2b9a743b27ba3b1c706e293))
* **insights:** people tip trigger carries the ? icon; tip tests skip it ([007c218](https://github.com/eric-maydeck/bean-tracker/commit/007c2180b70d555a2c39a4559abc16212f62367a))
* **insights:** render the people tip only where the people switch is ([30f057d](https://github.com/eric-maydeck/bean-tracker/commit/30f057db370204938083765821912504cfc65a30))
* **insights:** roasters compares raw, singular day suffix on the on hand tiles ([ba2c192](https://github.com/eric-maydeck/bean-tracker/commit/ba2c192ea1ad6abd158e0736cb543ef7a89f3f9a))
* **insights:** tighten the Caffeine board's head and decaf note spacing ([d10d7ef](https://github.com/eric-maydeck/bean-tracker/commit/d10d7effeb003854284692a10d057f65721f33c8))
* **insights:** trunc tip counts only clipping ancestors and keeps caption separators ([488f13a](https://github.com/eric-maydeck/bean-tracker/commit/488f13a02096bcd1987f2bbf0013bb1b5791ed77))
* **insights:** trunc tip label accepts a missing sub line ([86b1691](https://github.com/eric-maydeck/bean-tracker/commit/86b1691b3f19928cc19bf10a8ffe04a9dbfa336f))
* **insights:** what's waiting group-by keeps the clicked button in place at the page bottom ([482bf6f](https://github.com/eric-maydeck/bean-tracker/commit/482bf6f64371449ef3a4205b8a578cfed21879c9))
* **stats:** every vs-like baseline stays within the coffee's own caffeine kind ([61830b2](https://github.com/eric-maydeck/bean-tracker/commit/61830b24c66088fc8333e04efb2a53d2b4589c0e))
* **stats:** overview recent lists ignore the caffeine filter ([e1cb1ba](https://github.com/eric-maydeck/bean-tracker/commit/e1cb1bae628daf9882408feac6b0d84ab397c948))
* **stats:** people caption sits beside its switch in phone landscape, so the bar stays one row ([20a85b5](https://github.com/eric-maydeck/bean-tracker/commit/20a85b598d838a0d3d2fb3abcf62a5f63cb2d79a))
* **stats:** same-kind baselines drop unmatched bags from n, gates and samples ([23db4e0](https://github.com/eric-maydeck/bean-tracker/commit/23db4e073ceaa0917cf1bad27b379e388c94f6a7))
* **tests:** display-zone-tokyo runs in its own firefox so the timezone override holds under load ([32d05d0](https://github.com/eric-maydeck/bean-tracker/commit/32d05d05acaa80ebf08185280c1d7d320d00c1cf))
* **tests:** zone stamp checks read the Last updated time, not the first time in the footer ([9d7fc74](https://github.com/eric-maydeck/bean-tracker/commit/9d7fc740e2fd8b8f821eeed896606121ae8944ed))
* **tests:** zone stamps check against their own datetime, recap alert is a display-format stamp ([284b927](https://github.com/eric-maydeck/bean-tracker/commit/284b927666bfb421b68a7c57c02e1ab46d88c362))
* **time:** persist the first-boot brewing zone, always apply it ([2423f52](https://github.com/eric-maydeck/bean-tracker/commit/2423f521ac037729d35383344e339ec4c6a2c900))
* **time:** rest windows and link picker labels follow the date format ([b13f0d2](https://github.com/eric-maydeck/bean-tracker/commit/b13f0d2a284506255bb86199334fa811df8f5f46))
* **time:** zone aliases, like-coffees default caffeine, evening-safe stats test ([beb2d53](https://github.com/eric-maydeck/bean-tracker/commit/beb2d533afa3471dc0ec91a907949b8a19f4e883))


### Features

* **account:** bq import reports what changed ([4a3f6d9](https://github.com/eric-maydeck/bean-tracker/commit/4a3f6d9694a31048452a28376358715fe51ea9a8))
* **account:** brewing and display timezone settings ([0025ee9](https://github.com/eric-maydeck/bean-tracker/commit/0025ee93561456f1dba2ce805c23f49b4ff99a17))
* **account:** cap not-yet-tracked at 3 rows with show more (?untracked=all) ([a417d7d](https://github.com/eric-maydeck/bean-tracker/commit/a417d7d10e62570ab6133423f6a60ff32c2d3869))
* **account:** cleaner bq upload with a change summary ([61cf0e4](https://github.com/eric-maydeck/bean-tracker/commit/61cf0e4fde6eb4425522316e221545d3ae7419da))
* **account:** household size lives on account ([1c3c1cf](https://github.com/eric-maydeck/bean-tracker/commit/1c3c1cfd7ff33debd5508d3a9ae2a12b6ca3b399))
* **account:** not-yet-tracked bq beans move to account ([4953c53](https://github.com/eric-maydeck/bean-tracker/commit/4953c53053af400e5ea196c4ee74ee3933db37e4))
* **charts:** bar charts with a line over them open their tip for the nearest x ([60e9591](https://github.com/eric-maydeck/bean-tracker/commit/60e9591f6f53cae1bf81b371f3b7b21b7606271b))
* **charts:** every line chart opens its tip for the nearest x, as runway ([45980b8](https://github.com/eric-maydeck/bean-tracker/commit/45980b8c041180e5c712e3624036fec5dcb94431))
* **charts:** upright bar charts open their tip for the nearest x too ([00cb077](https://github.com/eric-maydeck/bean-tracker/commit/00cb07730f3f1af154ba3f1c7675c2b66559d5aa))
* **coffees:** filter window and column menus edit a draft; cancel, reset, apply ([216af2c](https://github.com/eric-maydeck/bean-tracker/commit/216af2c37b67c567768138ac2946667c7e8d651b))
* **insights:** caffeinated vs. decaf board ignores the caffeine filter; hint names the filter ([f9e690b](https://github.com/eric-maydeck/bean-tracker/commit/f9e690b47267da65c21b02714f6e704ee9f4ad87))
* **insights:** caffeinated vs. decaf board title and one Caffeinated label ([43241fe](https://github.com/eric-maydeck/bean-tracker/commit/43241fe0a39f7588ea365dfbd3d18279cfcaee2c))
* **insights:** caffeine board has no ranking floor; a small kind is marked, not hidden ([342a8da](https://github.com/eric-maydeck/bean-tracker/commit/342a8da6a08a2e4218f4af5f2923cd3d66be3211))
* **insights:** caffeine board is over time only, at a fixed chart height ([b7f654e](https://github.com/eric-maydeck/bean-tracker/commit/b7f654e9ca7a2ef9fd640354b8dff773429cf327))
* **insights:** caffeine board shows both kinds by default; caffeine=caffeinated shows one ([acb3d42](https://github.com/eric-maydeck/bean-tracker/commit/acb3d42f1eab98b31ec5282f92dc6680737cbcd8))
* **insights:** caffeine on leaderboards and what's waiting ([4017c27](https://github.com/eric-maydeck/bean-tracker/commit/4017c273b6fdd4fe305bdb47d54bf06f9ec8259f))
* **insights:** cut-off tile names show their full text in a hover and focus tip ([f182097](https://github.com/eric-maydeck/bean-tracker/commit/f18209708fdd968a8cd7619a24b6146cdc9a7680))
* **insights:** drop the decaf-hidden note from the caffeine board ([0d71f4c](https://github.com/eric-maydeck/bean-tracker/commit/0d71f4c74cb4257b5e6596e6532220441ca0eee6))
* **insights:** explicit caffeinated option in the filters dialog, same as default for now ([5184303](https://github.com/eric-maydeck/bean-tracker/commit/5184303a9dcb3323e5e79d3b0984901f9c84776f))
* **insights:** filters dialog caffeine select gets a distinct default option and hint ([3adf33b](https://github.com/eric-maydeck/bean-tracker/commit/3adf33b7a7dca45913019628f85c2479400ee8c1))
* **insights:** filters dialog edits a draft; cancel, reset and apply, click-out discards ([aa0dc01](https://github.com/eric-maydeck/bean-tracker/commit/aa0dc01036385d3ec18842cbaa7c39a60c1c032f))
* **insights:** hide the caffeinated vs. decaf board when only one kind has rated brews ([f9043ee](https://github.com/eric-maydeck/bean-tracker/commit/f9043ee1567aab70ed2ad3bda41af683804bf809))
* **insights:** last updated on overview ([26131fa](https://github.com/eric-maydeck/bean-tracker/commit/26131faf27137398ddbfaa5039b59229e4c45e39))
* **insights:** oldest unopened and bag states on on hand ([082bdbb](https://github.com/eric-maydeck/bean-tracker/commit/082bdbbdad4341b4b9c180b189396f981075924e))
* **insights:** people label opens a sticky help tip with the account link ([a937db9](https://github.com/eric-maydeck/bean-tracker/commit/a937db9718d6d074b0a90cbfec8460b6331d07ad))
* **insights:** roaster under the coffee name on the oldest and newest unopened tiles ([93215aa](https://github.com/eric-maydeck/bean-tracker/commit/93215aabbb29412a073e204a78855cb69d9ce486))
* **insights:** roasters, bag size and brew temp on overview ([a323695](https://github.com/eric-maydeck/bean-tracker/commit/a323695d705260ba14a82427fffb237f32bec7c3))
* **stats:** insights becomes /stats; old stats page removed ([806d4ea](https://github.com/eric-maydeck/bean-tracker/commit/806d4ea5eef3b88ff05141416811ad6e84f2e5bb))
* **stats:** stats name everywhere ([486259e](https://github.com/eric-maydeck/bean-tracker/commit/486259e4c1ecd94246bb7bead39a1afbff215165))
* **time:** brewing timezone drives day and hour lines ([62a88af](https://github.com/eric-maydeck/bean-tracker/commit/62a88af7ef3468af49bebc10d76c167ef425999f))
* **time:** display timezone with browser time by default ([425dabd](https://github.com/eric-maydeck/bean-tracker/commit/425dabd6228a3712eef97c76c1ea318eed6243cb))
* **time:** every calendar date follows the date format ([525339a](https://github.com/eric-maydeck/bean-tracker/commit/525339a2f7f38094599a17d0a787574572f4abe8))


### Reverts

* **insights:** drop the what's waiting height hold ([ce726d9](https://github.com/eric-maydeck/bean-tracker/commit/ce726d932c3fc8413250c3a070ada30fb57cb460))

# [1.108.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.107.0...v1.108.0) (2026-11-04)


### Bug Fixes

* alerts only store internal recap paths as href ([7585c18](https://github.com/eric-maydeck/bean-tracker/commit/7585c184739d8a930e9d6bd178cc1857bbd0f32e))
* close the alerts modal when following a recap alert link ([30f06c5](https://github.com/eric-maydeck/bean-tracker/commit/30f06c581f6359e7a50545a4e9e00dae4d95e1b9))
* days unit is unspaced (22–30d) ([7f54ad4](https://github.com/eric-maydeck/bean-tracker/commit/7f54ad41dd324c1e6f244c45f93cea0a2a54a8e2))
* **recaps:** a little more room above the per-person line ([9b31697](https://github.com/eric-maydeck/bean-tracker/commit/9b31697cf289420cac72b317e596e41aae6c8274))
* **recaps:** a value never parts from its unit, overflow and split checks ([fd531ea](https://github.com/eric-maydeck/bean-tracker/commit/fd531eae6ce6ad9539be1359e381b941c54ec09e))
* **recaps:** append facts that gain data after the freeze ([68394cd](https://github.com/eric-maydeck/bean-tracker/commit/68394cd4c7e5672ba46a5420618208dda4e92cfb))
* **recaps:** atomic card cache writes, cover footer ([95af479](https://github.com/eric-maydeck/bean-tracker/commit/95af4797da31d6f42d593d534b6e5bf3203ff46d))
* **recaps:** back ignores the reel's own navigations ([d2b79c5](https://github.com/eric-maydeck/bean-tracker/commit/d2b79c5e4569ed82a68444a5b68f52c2a8abab1f))
* **recaps:** banner fetch failure, hidden-on-recap check ([ef40337](https://github.com/eric-maydeck/bean-tracker/commit/ef403376247fded0022516f0740242026cd258c3))
* **recaps:** banner text centered, smaller pills ([89d6efc](https://github.com/eric-maydeck/bean-tracker/commit/89d6efcb33f6a559634385d7fe7c8332e8f942e4))
* **recaps:** card cache before recap, 404 chrome, preview no-store, test fixes ([7d85b8c](https://github.com/eric-maydeck/bean-tracker/commit/7d85b8c7eb3a7f194ffa8eaf860b2331829a9f94))
* **recaps:** centered slide block, poster spans before hydration, landscape fit ([4479c54](https://github.com/eric-maydeck/bean-tracker/commit/4479c54abbf60b4deaaf1062df20bf7db32806f2))
* **recaps:** cents on every amount of the spend slide ([8c61e85](https://github.com/eric-maydeck/bean-tracker/commit/8c61e85e38fe6de9814c84ffd130eee96eab20f5))
* **recaps:** chart value labels never sit on a mark, with a check ([025b34d](https://github.com/eric-maydeck/bean-tracker/commit/025b34d18f9cd5be230ec5133d1bcb15215acf0b))
* **recaps:** companion line tight under the big value, sub-sized ([36f9ce5](https://github.com/eric-maydeck/bean-tracker/commit/36f9ce558a24abd43a43b9d376ebbbeaaed80460))
* **recaps:** dial-in reads every brew, null-branch tests ([f9a2493](https://github.com/eric-maydeck/bean-tracker/commit/f9a2493754841e444aba3619963e3b8d19b33f8f))
* **recaps:** dial-in slide needs a first-brew gap of at least 0.1 ([8d5ee9e](https://github.com/eric-maydeck/bean-tracker/commit/8d5ee9ee4b77f6cd4811c7e3760684e4e4668cb6))
* **recaps:** every fact with data shows, cover tone from the year's theme ([1c10164](https://github.com/eric-maydeck/bean-tracker/commit/1c10164ae84a6a7e742b4ab5133367a7f6ea68f0))
* **recaps:** fill slides on desktop and phone, poster tile layout, copy fixes ([60e20f6](https://github.com/eric-maydeck/bean-tracker/commit/60e20f693b96f0bb5051c03490df3be3aa29883c))
* **recaps:** hour and decaf see-more label matches the Habits heading ([5ce8e90](https://github.com/eric-maydeck/bean-tracker/commit/5ce8e90c9188e189dbe886bc3e1fc06c0908b884))
* **recaps:** kebab-case fact ids, no empty context, real section labels ([8b3ec7f](https://github.com/eric-maydeck/bean-tracker/commit/8b3ec7fce475d9764b00d83e4ea0f7e74b2864e5))
* **recaps:** lazy per-1 pick, local year in the household test ([5cd7d5f](https://github.com/eric-maydeck/bean-tracker/commit/5cd7d5fc9bab7538c572aaf1da1492ac83554a91))
* **recaps:** no ready banner on the recaps index ([05c0e67](https://github.com/eric-maydeck/bean-tracker/commit/05c0e6776d8e15de34e48e9646ddde0037945918))
* **recaps:** poster rows close, full-width personality tile, fuller slides, legend colours ([95e64f0](https://github.com/eric-maydeck/bean-tracker/commit/95e64f0cb2398c1f0cc8911e716d549bc161ed08))
* **recaps:** readable names on tones, darker gold, progress ignore reason ([09e41b8](https://github.com/eric-maydeck/bean-tracker/commit/09e41b8120fdf408b344f5516351140f17b3372c))
* **recaps:** ready banner is an in-flow page banner ([808d948](https://github.com/eric-maydeck/bean-tracker/commit/808d9484f7135ac5c511cdaa0b1adcc4dd05f644))
* **recaps:** recap alerts drop the redundant source prefix ([af81145](https://github.com/eric-maydeck/bean-tracker/commit/af811454e651f9c0f6262ae45629f75b33dbc02c))
* **recaps:** rest band labels never carry a spaced d, and the check now sees it ([6239306](https://github.com/eric-maydeck/bean-tracker/commit/6239306b5cdd82b085aef5a11e65be485aae68b0))
* **recaps:** rest win copy uses the sweet spots card's figures ([055929f](https://github.com/eric-maydeck/bean-tracker/commit/055929feafec704f64b45a649e4ee704449ad82c))
* **recaps:** signed-out recaps tab shows an empty state with sign in, no redirect ([08fb48e](https://github.com/eric-maydeck/bean-tracker/commit/08fb48e73c1a56654b0ff299c876491633a6b3da))
* **recaps:** space before word units, sub line, top-aligned tile charts ([e06102c](https://github.com/eric-maydeck/bean-tracker/commit/e06102c430a6181359e4509c407705980cc2664e))
* **recaps:** tiles never freeze, recaps tab hides compare and people ([2c2e17a](https://github.com/eric-maydeck/bean-tracker/commit/2c2e17a22cb4590bb158f5c8543c61e175391c2b))
* **recaps:** toGenCtx wholeBrews and prevBrews as insights passes them ([028f502](https://github.com/eric-maydeck/bean-tracker/commit/028f5023497c4e062d1d62304a5b94e6ff0e3b66))
* **recaps:** unit spacing check accepts the non-breaking space ([49d8573](https://github.com/eric-maydeck/bean-tracker/commit/49d8573b3c1427bcdc869c297a2ad64ea98372db))
* **recaps:** use the stored ids when a first open races ([8fd1e90](https://github.com/eric-maydeck/bean-tracker/commit/8fd1e906f7200069a045d7843a093c03ba01517f))
* **recaps:** words never break mid-word, fixed-size tiles, period picks the years ([362ae39](https://github.com/eric-maydeck/bean-tracker/commit/362ae393c6e44cb87c9f06c0eaf03098f6f302d5))


### Features

* **recaps:** back and all recaps links over the reel ([b0a4337](https://github.com/eric-maydeck/bean-tracker/commit/b0a43378f7a4132f4a31ecbf8367d861467bb6d4))
* **recaps:** best bag roaster and coffee on two lines that fit the width ([01b035f](https://github.com/eric-maydeck/bean-tracker/commit/01b035f3b80ac957e0c72e0d98a41a9f3a120e85))
* **recaps:** best bag sub line, origin and decaf leads ([bb05f5b](https://github.com/eric-maydeck/bean-tracker/commit/bb05f5bd968300d0b00802c6901303dbf3b8a351))
* **recaps:** busiest day, bags finished, spend and best value facts ([f5aa295](https://github.com/eric-maydeck/bean-tracker/commit/f5aa2954d544c04d6f5997d62a0e5971389845bc))
* **recaps:** consistent bag, dial-in, weekend and dripper facts ([545f5dd](https://github.com/eric-maydeck/bean-tracker/commit/545f5ddb54d3177345d3d4834c9b30d74e691ad0))
* **recaps:** effect-size floors so only interesting facts show ([3278ee2](https://github.com/eric-maydeck/bean-tracker/commit/3278ee27f8aaf630648f953251031e64a017d464))
* **recaps:** household and per person toggle ([041abc6](https://github.com/eric-maydeck/bean-tracker/commit/041abc6f9561729e96699ce5f5818608fc7f6922))
* **recaps:** link previews for slides ([eac2bea](https://github.com/eric-maydeck/bean-tracker/commit/eac2bea2e7db3991a7e2f37bf5390c2a84ce76d1))
* **recaps:** per-person companion line replaces the people toggle ([9793a00](https://github.com/eric-maydeck/bean-tracker/commit/9793a001fc4cf1cd0987b8be191e44902c0a57ed))
* **recaps:** personality and trait pool ([12083c4](https://github.com/eric-maydeck/bean-tracker/commit/12083c4c5c63e739353c0dd08681169a50fa027c))
* **recaps:** poster slide ([313f936](https://github.com/eric-maydeck/bean-tracker/commit/313f9362bb38193a076f6353590aabc9626eb5af))
* **recaps:** preview card images ([953fef7](https://github.com/eric-maydeck/bean-tracker/commit/953fef767d863a5eedd343d7a9170e1dc4589adf))
* **recaps:** ranked selection, seeded order and theme, frozen ids ([b00d82e](https://github.com/eric-maydeck/bean-tracker/commit/b00d82e3da69b6d35518c2776d72e04f91dd848f))
* **recaps:** ranking facts always show, dial-in reframed as brews to settle ([0dbed2a](https://github.com/eric-maydeck/bean-tracker/commit/0dbed2add85e3db19752e94a56701ff92dc5fdcb))
* **recaps:** ready banner is a full-bleed strip above the nav in the cover tone ([59acdec](https://github.com/eric-maydeck/bean-tracker/commit/59acdecc189e0cd27f96e460f43075daf48a03cc))
* **recaps:** recap assembly, route load and thin prior-year seed ([c5bdebc](https://github.com/eric-maydeck/bean-tracker/commit/c5bdebca98a996959355d8126a15b1c4220cc6a9))
* **recaps:** recap ready banner ([4699c24](https://github.com/eric-maydeck/bean-tracker/commit/4699c2403004eecc87eba292766e1d032c818af5))
* **recaps:** recap ready notice also lands in the alerts inbox ([f05a73d](https://github.com/eric-maydeck/bean-tracker/commit/f05a73db3772c8ac4679022e53b0c70006349c94))
* **recaps:** recaps tab and index ([6a4380c](https://github.com/eric-maydeck/bean-tracker/commit/6a4380cd401b5d1fd752757f3f3d36b1d7e34989))
* **recaps:** recipe, ratio and rest facts ([e54c991](https://github.com/eric-maydeck/bean-tracker/commit/e54c9913e1b066fa512a88ec68fb9ab659cb9644))
* **recaps:** roaster, origin, producer, turn, record and price facts ([3aff853](https://github.com/eric-maydeck/bean-tracker/commit/3aff8533f54d709acb6400abdd0ed44b6665d293))
* **recaps:** sentence leads, best bag named, unit never splits mid-word ([1e4b4e4](https://github.com/eric-maydeck/bean-tracker/commit/1e4b4e4c8874491f5af10bd511eb3daeda2dff86))
* **recaps:** story slides with navigation and share ([d869f5c](https://github.com/eric-maydeck/bean-tracker/commit/d869f5c6d76fa912a3c5bbb642f424f890351804))
* **recaps:** streak and recipe leads, producer-roasters needs 5 roasters, cover copy ([ca6abe4](https://github.com/eric-maydeck/bean-tracker/commit/ca6abe49392126d76d97949ca605f1f793463cec))
* **recaps:** the recaps tab is the one recaps page ([a982de3](https://github.com/eric-maydeck/bean-tracker/commit/a982de32812d4b9abe7b3097406d46658a758f1e))
* **recaps:** title slide, rule 4 exemption for story progress ([79245e7](https://github.com/eric-maydeck/bean-tracker/commit/79245e7d07b094a159a297ae125f33d6015462d0))
* **recaps:** total, streak, hour and decaf facts ([e15c5de](https://github.com/eric-maydeck/bean-tracker/commit/e15c5de2f98169ea943478f609bfdb3596a31dea))
* **recaps:** url codec and availability ([70ca119](https://github.com/eric-maydeck/bean-tracker/commit/70ca119e974cac0df3fb68d26d45c274d084f4dd))
* **recaps:** weak effects get a steady headline instead of dropping out ([378ffeb](https://github.com/eric-maydeck/bean-tracker/commit/378ffebba3a66641c68088707496f0c8b301fe13))
* **recaps:** year context and fact types ([a3eeac2](https://github.com/eric-maydeck/bean-tracker/commit/a3eeac28cec5e74dcbe4a574c449b809449af197))


### Performance Improvements

* skip the brew scan once the newest recap year is alerted ([84a49d5](https://github.com/eric-maydeck/bean-tracker/commit/84a49d5722164dcb375019cde236baa7bb584a50))

# [1.107.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.106.0...v1.107.0) (2026-11-03)


### Bug Fixes

* **coffees:** inca gesha is SL9 ([203df4b](https://github.com/eric-maydeck/bean-tracker/commit/203df4ba787cad28e5df29250e57640ae1a59b8e))
* **coffees:** list icons in one row at the far right ([8c16d74](https://github.com/eric-maydeck/bean-tracker/commit/8c16d7457127db04bac2398455a0b7158d35d3d0))
* **coffees:** more region rows in the region batch ([f797665](https://github.com/eric-maydeck/bean-tracker/commit/f797665dd03845ffe80ae00c494cf704435b3d16))
* **data:** consolidate producer, variety and farm spellings ([cb0e392](https://github.com/eric-maydeck/bean-tracker/commit/cb0e39200e4f1f0d2d37dc22f63fe47682fb5f5b))
* **data:** region spellings and top levels for the map tip ([79a6705](https://github.com/eric-maydeck/bean-tracker/commit/79a6705ca4141371113df8ad8ba1005dfc6950a3))
* **insights:** a hover map tip the pointer lands on stays open until pinned ([a1b0e3c](https://github.com/eric-maydeck/bean-tracker/commit/a1b0e3cf0f4c9d64b5ffe01b7e45aeae22de8c8a))
* **insights:** board heads stay one row, expand moves into the chart, notes keep their space ([efa65c2](https://github.com/eric-maydeck/bean-tracker/commit/efa65c215723f0f29356e63087f5d1c951205117))
* **insights:** lowest first previews, blank varieties and tie order ([5e739b2](https://github.com/eric-maydeck/bean-tracker/commit/5e739b2644e4d9159d6f0fd9cb02585f0b65418a))
* **insights:** lowest first reads lowMove, tighter compare and prune states ([86164ce](https://github.com/eric-maydeck/bean-tracker/commit/86164cea3680199459a76dd0c619490b9463a578))
* **insights:** orange and inca gesha are their own variety rows ([d1847e0](https://github.com/eric-maydeck/bean-tracker/commit/d1847e0dc97e178ee519a56d3b76a6b82d630400))
* **insights:** singular hidden-groups note, expand button clear of the plot, sturdier head checks ([02a38c9](https://github.com/eric-maydeck/bean-tracker/commit/02a38c94f45bb7018939d28fab659705f4a0f4cd))


### Features

* **bq:** patch uses the roaster image when a coffee has none ([20e112c](https://github.com/eric-maydeck/bean-tracker/commit/20e112ce9f652ab703d5784f40425460ebe45fcc))
* **insights:** lowest first on every leaderboard ([54e9226](https://github.com/eric-maydeck/bean-tracker/commit/54e922611190087055eabc97f32211738dc00ed3))
* **insights:** the hidden-groups note offers the way back to the default Score ([b71d319](https://github.com/eric-maydeck/bean-tracker/commit/b71d319d1e6557df04b615bc1a296c3be273786c))
* **insights:** top regions in the world map tip ([e2faeeb](https://github.com/eric-maydeck/bean-tracker/commit/e2faeeb9ec4d22c46168b5d3f965a3ee0464ba2a))
* **insights:** varieties and producers leaderboards ([46da5ce](https://github.com/eric-maydeck/bean-tracker/commit/46da5ceaf288e17cc1676864c35ffd63ec58a04a))
* **insights:** variety and producer records ([3206d80](https://github.com/eric-maydeck/bean-tracker/commit/3206d8085c39031d242e0ac984ef01c3a531bfb0))
* **insights:** variety and producer records follow their board, boards offer the hidden groups ([225d490](https://github.com/eric-maydeck/bean-tracker/commit/225d490a6ea271900120e960bf945959fde7f4ae))

# [1.106.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.105.0...v1.106.0) (2026-11-02)


### Bug Fixes

* **scripts:** verify comma numbers and shopify json in the bean data check


### Features

* **coffees:** backfill origin details from the reviewed bean data ([2c3f6b1](https://github.com/eric-maydeck/bean-tracker/commit/2c3f6b10e72e10705444f8fae3b5a0c3538c7bf3))
* **coffees:** one format for elevation, harvest, variety and region ([769a300](https://github.com/eric-maydeck/bean-tracker/commit/769a30016953bd97af43eaccbde07925fd043040))

# [1.105.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.104.0...v1.105.0) (2026-11-02)


### Bug Fixes

* **bq:** decaf null, script-relative db guard, dry-run with plan, missing images ([a212b98](https://github.com/eric-maydeck/bean-tracker/commit/a212b98b0e0c151908ae9b8845a46042f403df8f))
* **bq:** fill blank coffee fields by coffee id, not origin id ([3af1e09](https://github.com/eric-maydeck/bean-tracker/commit/3af1e09aec912c1056782ffb3d6a23f7017f086d))
* **bq:** report duplicate uuids and count gaps; resolve --out before temp zip ([5d45523](https://github.com/eric-maydeck/bean-tracker/commit/5d45523af389f22d6e199ed2b766f9ab7c06b477))
* **coffee-form:** switching off blend removes only the auto-filled origin ([c6c50c3](https://github.com/eric-maydeck/bean-tracker/commit/c6c50c3b49a6665632e91cf30cc8a85dc7b74b1d))
* **coffee:** size the share QR to at least 3px per square, within the panel ([f6dd0be](https://github.com/eric-maydeck/bean-tracker/commit/f6dd0be9ceb1a064576b66778bf3109b19cbdf84))
* **scripts:** edit without a proposal, one review row per disagreement, keep on reject ([3176b0c](https://github.com/eric-maydeck/bean-tracker/commit/3176b0cdf7e559eaf1c73be364d102f9e047836c))
* **scripts:** merge into an existing keep.json instead of overwriting it ([a2b0500](https://github.com/eric-maydeck/bean-tracker/commit/a2b0500fdb5ede5e2dab11458867007c9bd8af10))
* **scripts:** settled.json, stricter auto rule, shown approve value and format checks
* **scripts:** word-boundary source check, one outcome per field, guarded input paths ([2c82d14](https://github.com/eric-maydeck/bean-tracker/commit/2c82d14e5d175e3ee8d0170bf5ab3031104cebf2))


### Features

* **bq-share:** send the coffee image so bq saves its own copy on import ([5bfb2d0](https://github.com/eric-maydeck/bean-tracker/commit/5bfb2d097e8bf51565adc250f4e965daca8adde5))
* **bq:** build the patch plan from the site ([1370910](https://github.com/eric-maydeck/bean-tracker/commit/137091084cac60b7b95d3dc74a986a6242bf5840))
* **bq:** patch beans in a BQ export without touching anything else ([16226c8](https://github.com/eric-maydeck/bean-tracker/commit/16226c858551fef3db11f8e752f3b08703755f24))
* **bq:** refuse unsettled overwrites and new-bean duplicates in the patch plan ([25715ac](https://github.com/eric-maydeck/bean-tracker/commit/25715ac3e9f51e3f652fad77ea70f85b88ec003f))
* **bq:** send origin details to BQ and fill blanks from it ([67421cf](https://github.com/eric-maydeck/bean-tracker/commit/67421cfafc3debfeaefbf8404c7d9f48f0cc1f77))
* **coffee-form:** group fields as Origin, Bag and Timing in the page's order ([d095b46](https://github.com/eric-maydeck/bean-tracker/commit/d095b4664e38f3cbf3770c0b734b2dc33f43d039))
* **coffee:** show the roaster as its own heading line below the name ([889ed76](https://github.com/eric-maydeck/bean-tracker/commit/889ed7662f0033c7ed8b665f0767696deef49869))
* **coffee:** single origin / blend field, carried to bean conqueror as beanMix ([0acaa69](https://github.com/eric-maydeck/bean-tracker/commit/0acaa69bcad43837faeb5bd3df77ebbce87d14a8))
* **coffee:** split the stat grid into Origin and Bag sections ([6839440](https://github.com/eric-maydeck/bean-tracker/commit/683944090493d8fac58aa5d14a26fa35571c8fd8))
* **coffees:** producer, farm, variety and other origin fields ([ef2db35](https://github.com/eric-maydeck/bean-tracker/commit/ef2db3529661e306642e55bfd95715bea8eb831d))
* **fill:** fill origin details and keep processing concise ([93fb169](https://github.com/eric-maydeck/bean-tracker/commit/93fb1693816bf272a8a1a6958c99c02a50d88f24))
* **scripts:** input, contract and source check for the bean data backfill ([7aded06](https://github.com/eric-maydeck/bean-tracker/commit/7aded06c999bbb904ace4ca21f1a46f0c3671434))
* **scripts:** review page and guarded batch for bean data ([abb4fe5](https://github.com/eric-maydeck/bean-tracker/commit/abb4fe553f1d03ad59a5bd70ebed58cb7b0c677c))

# [1.104.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.103.0...v1.104.0) (2026-11-01)


### Bug Fixes

* **water:** convert drops boxes when the tip changes in another mode ([1a854a2](https://github.com/eric-maydeck/bean-tracker/commit/1a854a2bb5fbf7ebba1f5bebffc12530d92b0de2))
* **water:** same size for every switch-volume button ([da9bcf6](https://github.com/eric-maydeck/bean-tracker/commit/da9bcf6f4a7a57378465e6659f03f5e5a6f67c7b))


### Features

* **water:** anchor drops across tip switches, name the tip in link previews ([35fb6e7](https://github.com/eric-maydeck/bean-tracker/commit/35fb6e7715ebc3e01bf0b816ac5403bfc915d25e))
* **water:** choose round-tip or precision dropper ([5062bea](https://github.com/eric-maydeck/bean-tracker/commit/5062bea6f0c62ca3e47e9e9f58d0455bfd8d30de))
* **water:** default water follows the tip, label the tip line in link previews ([29e96d0](https://github.com/eric-maydeck/bean-tracker/commit/29e96d099a8ff37562ca7d84f42a93d95c1f962a))
* **water:** suggest two volumes when the best one exceeds a 1000mL kettle ([e3521df](https://github.com/eric-maydeck/bean-tracker/commit/e3521df694e58bbeb8a5580feed14781d7288c88))

# [1.103.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.102.0...v1.103.0) (2026-10-31)


### Bug Fixes

* **coffees:** list tap targets and tips; tests for buttons in the actions cell ([f94b686](https://github.com/eric-maydeck/bean-tracker/commit/f94b686004ed3dd1b6bcf1d67e3ff6e70373e2cd))
* **coffees:** scope list row styles to the coffees list; stricter list tests ([3645738](https://github.com/eric-maydeck/bean-tracker/commit/36457385a0264bba07645b6a7d7748ad62ff9e2f))
* **layout:** one page width on desktop, matching insights ([3279bc8](https://github.com/eric-maydeck/bean-tracker/commit/3279bc8db13b86761bc2f30da0cffb295d00634a))
* **ui:** ai dialog follows history, keeps page params, bigger link taps, review fixes ([8942b62](https://github.com/eric-maydeck/bean-tracker/commit/8942b62946b49cd5c6072a470ee5b5d8fadd6f60))
* **ui:** fading footer divider, smaller dialog text, restore app.css ([f0a7699](https://github.com/eric-maydeck/bean-tracker/commit/f0a76995faa79a0ebd32d425195cb72fbfec7adc))


### Features

* **account:** two-column cards on wide screens ([91cf7c7](https://github.com/eric-maydeck/bean-tracker/commit/91cf7c767c2bbde1f2b0250eb0685293132ed236))
* **coffees:** shorter list rows, one-row actions, two-line clamp ([fa4e73a](https://github.com/eric-maydeck/bean-tracker/commit/fa4e73a049a1c5b423bd6b447e5c2b7d911f7bd9))
* **ui:** ai disclaimer footer line, how-it-was-built dialog and contact link ([4f001df](https://github.com/eric-maydeck/bean-tracker/commit/4f001dfea97a709c6473486f33a9e1249b67b0e1))
* **ui:** footer as two flowing lines of dot-separated items ([95b7c3f](https://github.com/eric-maydeck/bean-tracker/commit/95b7c3fde1ec5a6052cb3dcb22dde793f618b9e6))
* **ui:** stack the footer one item per line on phones ([f98710b](https://github.com/eric-maydeck/bean-tracker/commit/f98710b0a8f977ea6dae5e2021b019999d049620))

# [1.102.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.101.0...v1.102.0) (2026-10-31)


### Bug Fixes

* **coffees:** staged edits keep a cleared image source; go route only treats 404 and 410 as dead ([c82316e](https://github.com/eric-maydeck/bean-tracker/commit/c82316e4b61ebcf0acaa4792d0c90157cf5c0423))


### Features

* **coffees:** add the Tavily-found source for Scenery Don Senel Milenio ([1fd6324](https://github.com/eric-maydeck/bean-tracker/commit/1fd6324fa088deecccd69ad8c5531375edd22848))
* **coffees:** backfill image_source_url from the pages the images are on ([139c078](https://github.com/eric-maydeck/bean-tracker/commit/139c07826e15a9a792e3e1674b4d831c95e3fe47))
* **coffees:** image credit under the photo, with a dead-link check route ([f1b30eb](https://github.com/eric-maydeck/bean-tracker/commit/f1b30eba9d248682f53722fa72b0dde7e09703cd))
* **coffees:** store the page an image came from (image_source_url) ([db82e3d](https://github.com/eric-maydeck/bean-tracker/commit/db82e3d53b0a81800f46439d759c1f8f7ec9d93e))
* **coffees:** switch the Ceto Mugaya photo to its live product page; tavily pass script ([6fdd50f](https://github.com/eric-maydeck/bean-tracker/commit/6fdd50fda48e77d875bcb60bb2105067a2f7a53f))
* **coffees:** weessi tima and adamo take their live scenery page photos ([d39a3fb](https://github.com/eric-maydeck/bean-tracker/commit/d39a3fb6af6f55dac59574857ebaacde3da4dc17))

# [1.101.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.100.0...v1.101.0) (2026-10-30)


### Bug Fixes

* **recipes:** editor control heights, length row spacing and styling, scroll to card on close ([18743af](https://github.com/eric-maydeck/bean-tracker/commit/18743af4205bc1d7fd5e0e997e91fed4e9deb812))
* **recipes:** equal-width length buttons, inert full ratio pair, Save keeps its card on top ([416766f](https://github.com/eric-maydeck/bean-tracker/commit/416766f0530604b96c12ddc4237cb87bf3995c58))
* **recipes:** length fix keeps an unnamed recipe's bloom hold and tolerates a def without pours ([116a10f](https://github.com/eric-maydeck/bean-tracker/commit/116a10fa3c76f6516aff84d80bdc9852e9dfe5fc))
* **tips:** a click with no tip to pin, or on a control inside the trigger, no longer pins it ([eaa4a33](https://github.com/eric-maydeck/bean-tracker/commit/eaa4a33808a3e5ec25d1637c046b807bf4ce0a7c))


### Features

* **recipes:** at 5 ratios the input and Add are disabled with a tip saying why ([383a143](https://github.com/eric-maydeck/bean-tracker/commit/383a14345136b9c6998bef0fbff70f659424fda2))
* **recipes:** bloom lengths 30-60s; length chips 20s, 30s, 45s, 1m ([a9a8c71](https://github.com/eric-maydeck/bean-tracker/commit/a9a8c712c6364cbcd60319a91fa3c243db8931ef))
* **recipes:** editor focuses custom boxes, disables unit on equal shares, tighter spacing ([8cc0725](https://github.com/eric-maydeck/bean-tracker/commit/8cc0725aa10b6fa3d864d78d7a59d192c3165959))
* **recipes:** editor sets each step's length; last step reads until drained ([d28c351](https://github.com/eric-maydeck/bean-tracker/commit/d28c35105e074c0cb51e20331d7a3d4985382138))
* **recipes:** length row with custom time box, range boxes and parsed durations ([017f820](https://github.com/eric-maydeck/bean-tracker/commit/017f820c7e829e84c4d6aea40ae66bdce2a7ca75))
* **recipes:** phone length row on one line, three buttons one width ([03256ea](https://github.com/eric-maydeck/bean-tracker/commit/03256ea41d8d9a46c4b90addddbdfb19d44c4ff7))
* **recipes:** phone length row puts the four preset times on one full-width row ([135975d](https://github.com/eric-maydeck/bean-tracker/commit/135975d8c109479789c94800e18378fb5fe6742d))
* **recipes:** ratios as an add/remove list; settings block on one grid ([a31703b](https://github.com/eric-maydeck/bean-tracker/commit/a31703b551f8abad78f3205ac1bda3aa75d8e79c))
* **recipes:** ratios as one wrapping row of cells; settings order and inset 1: prefix ([a197210](https://github.com/eric-maydeck/bean-tracker/commit/a19721023575bd5ab30861ebd2b2203e9c3af5ae))
* **recipes:** steps own their length; boot fix converts stored recipes ([9a454c8](https://github.com/eric-maydeck/bean-tracker/commit/9a454c8885116f33be6a531e29041869f7236fd6))

# [1.100.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.99.0...v1.100.0) (2026-10-30)


### Bug Fixes

* **charts:** tips stay dismissed on pointer moves, hide with their mark, anchor on keyboard open ([45b258a](https://github.com/eric-maydeck/bean-tracker/commit/45b258af0e22339cac06f71ccbc550cd4304ca09))
* **recipes:** align the target and up-to boxes with the chips ([73184d5](https://github.com/eric-maydeck/bean-tracker/commit/73184d583427c57b7151add5d0d5d79682bfe877))
* **recipes:** an after trigger on the pour following a bloom replaces the legacy hold check ([c3a1575](https://github.com/eric-maydeck/bean-tracker/commit/c3a157518a362a75f1b83d1dded2724b0d29842b))
* **recipes:** clear message for an empty trigger time and keep the last custom pair ([efc5ec0](https://github.com/eric-maydeck/bean-tracker/commit/efc5ec088d5dea5918198f2dcf3f2257d9c4a0a7))
* **recipes:** describe a bloom by the wait after it, not the legacy hold ([6c9d16d](https://github.com/eric-maydeck/bean-tracker/commit/6c9d16ddc2557ca8b10b014202639b9bf5e5bc88))
* **recipes:** dyb boot fix sets 91°C ([40c8640](https://github.com/eric-maydeck/bean-tracker/commit/40c86408ba4f0e6bc4fb001a2d1b9680c9415a4b))
* **recipes:** hide the g/s range in steps text for any-speed recipes ([bdb1763](https://github.com/eric-maydeck/bean-tracker/commit/bdb176375caa433fb91fa3235eeecf2c76ed5d2e))
* **recipes:** keep diffs for tagged brews without a usable ratio ([b6ae438](https://github.com/eric-maydeck/bean-tracker/commit/b6ae438f33b18d85f9d2d765e02cc0ebf15a283c))
* **recipes:** no space between a number and its unit; step tips always say blooms ([5c65b47](https://github.com/eric-maydeck/bean-tracker/commit/5c65b47b903a3afc8c722fdca02914aafef8778f))
* **recipes:** ratio target updates in the boot fix; report notes voided tags ([99a2f74](https://github.com/eric-maydeck/bean-tracker/commit/99a2f745577250013487bd1ea699452b83c47c5c))
* **recipes:** shoebox boot fix uses a 30 s second pour and low-water pours three and four ([e065bc0](https://github.com/eric-maydeck/bean-tracker/commit/e065bc0ca991380699c1d34dd3225053b6d6d7dc))
* **recipes:** skip colliding shoebox names and mismatched pour counts in the boot fix ([256998f](https://github.com/eric-maydeck/bean-tracker/commit/256998fb327cf147f7c9e35482a3f0a9ff4ffd45))
* **units:** litres unspaced (12L) ([84feafb](https://github.com/eric-maydeck/bean-tracker/commit/84feafb34c597d1822af178f903f44dcb96c4bd8))


### Features

* **charts:** every chart tooltip follows the pointer and sits at a tap's point ([df417a5](https://github.com/eric-maydeck/bean-tracker/commit/df417a5950deb3fb982a70d45c6dcc122a0c3a17))
* **recipes:** bands cover the whole bloom, solid to the target and striped up to the latest start ([852cfad](https://github.com/eric-maydeck/bean-tracker/commit/852cfad521195573169deb0ae823a97b7311937a))
* **recipes:** boot fix rewriting the recipes with shares, triggers and ratios ([f80ea64](https://github.com/eric-maydeck/bean-tracker/commit/f80ea6486880faeb32e6d34c42d2e3854e5243df))
* **recipes:** chart band and pour-fill colours as theme tokens (option 12, fills d) ([dc6e130](https://github.com/eric-maydeck/bean-tracker/commit/dc6e130a178aff6b5351958f93508d1d04c741da))
* **recipes:** chart bands read as the bloom's length, tinted and with a tip ([ef1f224](https://github.com/eric-maydeck/bean-tracker/commit/ef1f224d3ee38e933bcac4d26e0043ef06c03578))
* **recipes:** chart mark tooltips follow the pointer and sit at a tap's point ([b8bd3f2](https://github.com/eric-maydeck/bean-tracker/commit/b8bd3f2032eaea86030aac66f1de76ce31d0e5e6))
* **recipes:** chart tooltips write time ranges with arrows ([91b4683](https://github.com/eric-maydeck/bean-tracker/commit/91b468355ad91439a53f4475e74ad6bd4739e50d))
* **recipes:** count speed diffs double and relax matching for flow-controlling drippers ([5bb7af0](https://github.com/eric-maydeck/bean-tracker/commit/5bb7af026cb62783eefa4bf0f366ca70b7de87ee))
* **recipes:** draw trigger windows on recipe and brew charts ([9be93cd](https://github.com/eric-maydeck/bean-tracker/commit/9be93cdb939d2bdbe6d34c215a4607a415e986c3))
* **recipes:** editor note for flow-controlling drippers ([601e022](https://github.com/eric-maydeck/bean-tracker/commit/601e0220002dc7ce684fee7cbc2f39d23595f31e))
* **recipes:** flow recipes default to water low from pour 3; gabi and dyb boot fixes ([2193066](https://github.com/eric-maydeck/bean-tracker/commit/2193066e907fc8b642f2fbe106287d3ece1bc91c))
* **recipes:** ignore advice sentences in notes and allow shared tags ([6bc057d](https://github.com/eric-maydeck/bean-tracker/commit/6bc057d18f226205f6c6f4b824c87ac04e27647f))
* **recipes:** match brews by pour shares, trigger gaps, ratio list and temperature ([734cf8e](https://github.com/eric-maydeck/bean-tracker/commit/734cf8e639d5963ca9d86164ca5b4d847288022d))
* **recipes:** mixed linked bloom times make a modified variant ([2e6f39b](https://github.com/eric-maydeck/bean-tracker/commit/2e6f39be86a60b8f0c539f8a2898c7867813c13d))
* **recipes:** one solid band per bloom in its own tint; flow recipes draw a steady rate ([d067584](https://github.com/eric-maydeck/bean-tracker/commit/d06758419fdab29891e941cc19f9489b98b69eac))
* **recipes:** range chip with narrow target and up-to inputs in the chips row ([905d364](https://github.com/eric-maydeck/bean-tracker/commit/905d364581d1733a2dae61000d193c40b5110528))
* **recipes:** steps show targets only, with the longer time in a tip ([4e711cd](https://github.com/eric-maydeck/bean-tracker/commit/4e711cdcf32fb633326ce6293432064a1c0027a2))
* **recipes:** steps text for a recipe ([7481f8a](https://github.com/eric-maydeck/bean-tracker/commit/7481f8ae856707f07a9f9644bc8538be6c20504d))
* **recipes:** steps, temperature and notes on recipe cards and link previews ([fbcd022](https://github.com/eric-maydeck/bean-tracker/commit/fbcd022521fcae3de1661e4081504cec2ad33a0f))
* **recipes:** target and up-to inputs use the site's form fields with labels above ([e2ff94c](https://github.com/eric-maydeck/bean-tracker/commit/e2ff94c27f64f2d615c8dabec6a5af50d1601216))
* **recipes:** tooltips on every chart mark, actual times on brews; flow pours spaced like pour 3 ([60d415a](https://github.com/eric-maydeck/bean-tracker/commit/60d415ac1fbb4785d5d2451732a3cbad2f7ead9e))
* **recipes:** trigger, equal shares and ratio list controls in the editor ([b6350af](https://github.com/eric-maydeck/bean-tracker/commit/b6350af40d29bd3d9edbaa03fe17dc74a2b52921))
* **recipes:** triggers, equal split and ratio targets in the recipe model ([8c582b8](https://github.com/eric-maydeck/bean-tracker/commit/8c582b8efdda759b9598db0713378a5107d3ae9f))
* **units:** no space between a number and its unit site-wide ([e039883](https://github.com/eric-maydeck/bean-tracker/commit/e03988309ff0729cbbd88250e66d7525705cfe3b))

# [1.99.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.98.0...v1.99.0) (2026-10-29)


### Bug Fixes

* adding an existing dose or ratio is an error, not an Added toast with Undo ([6e561a0](https://github.com/eric-maydeck/bean-tracker/commit/6e561a085a2b916499cf8c1276efc80f663ea1fa))
* **brew-now:** a filter pick keeps the dripper, grind before grinder, prompt spacing ([d2421b9](https://github.com/eric-maydeck/bean-tracker/commit/d2421b9030a93e8f6a485a88826808c8dbb44e14))
* **brew-now:** deleted brew re-pends its mark, key marks by id ([ba6b31c](https://github.com/eric-maydeck/bean-tracker/commit/ba6b31c00511806fac42702ee21a27c735847431))
* **brew-now:** device filter papers only show where used ([7b21a24](https://github.com/eric-maydeck/bean-tracker/commit/7b21a245bac962314d4c80f72cf834e110b26845))
* **brew-now:** dose and ratio no longer depend on the picked gear ([f237392](https://github.com/eric-maydeck/bean-tracker/commit/f23739249558208968da8f4286db123ed4075220))
* **brew-now:** filter sizes no longer limit other filters ([5f2d209](https://github.com/eric-maydeck/bean-tracker/commit/5f2d209cf82f6eaf3b4e541fa4156220ba270b84))
* **brew-now:** final review fixes ([b562ef7](https://github.com/eric-maydeck/bean-tracker/commit/b562ef70141063640c7c63859343a66cd7600875))
* **brew-now:** flat bottom drippers also take flat-bottom basket filters ([c64e1d3](https://github.com/eric-maydeck/bean-tracker/commit/c64e1d39e545f36ad9bf7b0aa4e7bdfa93786306))
* **brew-now:** gear fallback only when gear has no brews, copy, step ([a79cda0](https://github.com/eric-maydeck/bean-tracker/commit/a79cda0e222292efc48f5b5b1479a86cdc1fe8a0))
* **brew-now:** keep brew notes private, admin-only recipe link, seed ([61080bb](https://github.com/eric-maydeck/bean-tracker/commit/61080bb726277dd4422fb1238d95dacb534344ad))
* **brew-now:** no gear lurking sentences on dose and ratio ([8097d63](https://github.com/eric-maydeck/bean-tracker/commit/8097d63b2cce7c3a7c125227850d2dbe8fdd2f47))
* **brew-now:** other filters need two drippers of the class ([1f6be6d](https://github.com/eric-maydeck/bean-tracker/commit/1f6be6d74615800b5ddb341bc615e6e6c72a97e6))
* **brew-now:** recipe link points at the recipe anchor ([79ffa5a](https://github.com/eric-maydeck/bean-tracker/commit/79ffa5aaea6c5b7934fbe387b19e991fea2f3b8c))
* **brew-now:** roast age reads 150d ago ([9f6f751](https://github.com/eric-maydeck/bean-tracker/commit/9f6f751782d55ca717fbf444ce6e5e5fccc059ff))
* **brew-now:** seed no longer perturbs insights, compact link, card hover ([af7abfd](https://github.com/eric-maydeck/bean-tracker/commit/af7abfde700a00b99eaffb66f354abaf196a05d5))
* **brew-now:** www-insensitive roaster site match, safe recipe host, tighter test ([7622089](https://github.com/eric-maydeck/bean-tracker/commit/76220895bfcf2ab065e9fd908e5e66cf1c5fa81e))
* **insights:** findings cards tighten one more step; hairline bars skip the fold check ([302e720](https://github.com/eric-maydeck/bean-tracker/commit/302e7207380e983e7c436bbf83e33628b2d64e68))
* recipe brew time tip anchors to its text, toasts sit closer to the top ([1656a77](https://github.com/eric-maydeck/bean-tracker/commit/1656a77f36a1935df4993ae15c130005bbc1253d))
* recipe rename and delete on a slug page no longer 404; Recipes nav stays current ([a475f2e](https://github.com/eric-maydeck/bean-tracker/commit/a475f2e2e074d9e72ecfabc767230d6e23fba923))
* staged status icons show as pressed and the pending badge sits under them ([3825d58](https://github.com/eric-maydeck/bean-tracker/commit/3825d586a96061ae263ea8be08393f638e51e935))
* toast undo button keeps its width on phones ([85047e9](https://github.com/eric-maydeck/bean-tracker/commit/85047e9bf9d1b90bd5e32b6243d421570e07307e))
* undo restores the exact earlier coffee state; unarchive clears drank ([0c92baa](https://github.com/eric-maydeck/bean-tracker/commit/0c92baaba998c7bdfcf0cc09949f7e1cb0e982d7))


### Features

* apostrophe-free recipe slugs, toasts leave one by one, steady edit icons ([926e927](https://github.com/eric-maydeck/bean-tracker/commit/926e9278e480cd98be33521f9dca890178f55e61))
* **brew-now:** aligned evidence grid, working tip links, green best dot, undo toasts ([2c2aca5](https://github.com/eric-maydeck/bean-tracker/commit/2c2aca5c33fb83ee24211160476a422e3381e738))
* **brew-now:** brew now buttons on on-deck, coffees and coffee page ([0acd1c9](https://github.com/eric-maydeck/bean-tracker/commit/0acd1c9d0a97c8b1a42a73af2db0a6ef3a5f9e5f))
* **brew-now:** brew this mark and outcome check ([b46a910](https://github.com/eric-maydeck/bean-tracker/commit/b46a9108724dc259c28946c4105995382f0d5972))
* **brew-now:** clearer gear field for brew now evidence ([fc4e18a](https://github.com/eric-maydeck/bean-tracker/commit/fc4e18a3f67f9e96d994352dfa9947bb9c5045a6))
* **brew-now:** clearer ownData wording, migrate stored values ([29d083a](https://github.com/eric-maydeck/bean-tracker/commit/29d083aeb2bd6e732ca16b474dabb50ca16eccae))
* **brew-now:** dose prefs and entry links ([3559059](https://github.com/eric-maydeck/bean-tracker/commit/3559059f2f4db6bf3d14e447c39238e409e9df7a))
* **brew-now:** dot plot, evidence table, basis popover, round 2 page ui ([f6317c9](https://github.com/eric-maydeck/bean-tracker/commit/f6317c956230c8c8435e1204378d57e64a1d9d19))
* **brew-now:** editable dose and ratio lists on the account page ([612f675](https://github.com/eric-maydeck/bean-tracker/commit/612f67593809e2c583976d0a582b6fe63090f18f))
* **brew-now:** evidence recipe names link to their recipe page ([8f7a415](https://github.com/eric-maydeck/bean-tracker/commit/8f7a415bee502830742e080331f915f67206291e))
* **brew-now:** filter choices relevant to the dripper ([31d9b65](https://github.com/eric-maydeck/bean-tracker/commit/31d9b65135ed0acecdc248520f46fafacff07ad4))
* **brew-now:** load brews, gear classes, defaults ([d0a6eea](https://github.com/eric-maydeck/bean-tracker/commit/d0a6eeae27583ba35ec2c05c47b17fbe5deb7428))
* **brew-now:** natural synopsis, ratio row, dose plan, open coffee, other gear lists ([77249b5](https://github.com/eric-maydeck/bean-tracker/commit/77249b5cdb6445b28321f5a8ae4664bed6dca5a5))
* **brew-now:** open button on on-deck next up cards ([bab76cf](https://github.com/eric-maydeck/bean-tracker/commit/bab76cffc249eeb1964d28d40faab4b5ecd54c8c))
* **brew-now:** other filters follow the gear details' shapes and sizes ([c587588](https://github.com/eric-maydeck/bean-tracker/commit/c587588a5e7af7c918ad3340308a3f417fd6fea0))
* **brew-now:** other-gear dropdown, advice label, best crown, toasts, see coffees fix ([d7be8c1](https://github.com/eric-maydeck/bean-tracker/commit/d7be8c1c3a674189388810d3d812801eea0e8fde))
* **brew-now:** page ([1daa3d0](https://github.com/eric-maydeck/bean-tracker/commit/1daa3d0f7f36a45f6976ffeebccc53a92e0a30ad))
* **brew-now:** preview-temp grind trend alternatives ([e9aa852](https://github.com/eric-maydeck/bean-tracker/commit/e9aa852ff91ed83b4b357ef9325bd80e4bd1348a))
* **brew-now:** readable dose grid, import icon on coffees rows ([64b5ca7](https://github.com/eric-maydeck/bean-tracker/commit/64b5ca7eeecf4c81d15ad1cbe31779ebf1dad6da))
* **brew-now:** roaster recipe search ([e046b1b](https://github.com/eric-maydeck/bean-tracker/commit/e046b1bf0d06f7d67fef153c227d0cbea0e8598d))
* **brew-now:** round 3 page ui, dose and ratio chips, chart tips, open prompt ([fdacc44](https://github.com/eric-maydeck/bean-tracker/commit/fdacc446bcdf43f7ce0d8c334d24e2d72e42960f))
* **brew-now:** schema, gear own-data flag, dose prefs ([49cea46](https://github.com/eric-maydeck/bean-tracker/commit/49cea4649df19737148f95d3019147ff039175ea))
* **brew-now:** suggestion engine ([b428339](https://github.com/eric-maydeck/bean-tracker/commit/b42833990b13c97416410579849219e203a25e89))
* **brew-now:** tiers, pooling, confidence labels, synopsis, mark expiry ([82b6a56](https://github.com/eric-maydeck/bean-tracker/commit/82b6a5659cd2f29b1a3dbfc8d6c19a6439379584))
* **brew-now:** url state ([6f00ffc](https://github.com/eric-maydeck/bean-tracker/commit/6f00ffc227c48c8693f1d93d6a234f13bbbce8ab))
* coffee action toasts, unarchive replaces restore; fix ui state placement ([52efae0](https://github.com/eric-maydeck/bean-tracker/commit/52efae0d95ff18210561f290dd1e8c5ac1d42629))
* on deck tile menu, toast undo wiring, edit param, account row spacing, undo tap target ([d05819e](https://github.com/eric-maydeck/bean-tracker/commit/d05819ecd362694e9c48c47b781015fd3b22e1e5))
* on deck tiles use coffees' icon set, backlog Open icon, stable list columns on Edit ([b1bb4e9](https://github.com/eric-maydeck/bean-tracker/commit/b1bb4e9e061f125ad4ef7f885ffa81a26d6c044d))
* recipe anchors, hide brews toggle, account toasts and layout, gear tip; drop recipes redirect ([358b4c3](https://github.com/eric-maydeck/bean-tracker/commit/358b4c3be4a14c1ba6e3971d155eea5c738eb5fd))
* recipes as a public page between insights and water ([18c1de8](https://github.com/eric-maydeck/bean-tracker/commit/18c1de8e4886fd1bb9c3f38cc953d3aea0949d99))
* recipes at /recipes/<name-slug> with link previews; brews' time as a range ([cf19760](https://github.com/eric-maydeck/bean-tracker/commit/cf19760a3dd92aa14db0f1fdc817137256d7c796))
* server-resolved recipe slug on brew rows, undo on add and clone, left-aligned toasts ([c65a6c1](https://github.com/eric-maydeck/bean-tracker/commit/c65a6c1a448f2874b17683b2fd31e12cb5b50343))
* shared status toast helper ([1c68adc](https://github.com/eric-maydeck/bean-tracker/commit/1c68adc3d21a6780bc9fd4b683ed9d8c6429c358))
* stacked toasts with undo, hover pause and smaller text ([a470ec1](https://github.com/eric-maydeck/bean-tracker/commit/a470ec1df34072e836d326d23fe81a8a98a35e65))

# [1.98.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.97.0...v1.98.0) (2026-10-28)


### Bug Fixes

* **insights:** pours rest jump link, ratings note on empty tab, recipe editor save locator ([a66aa96](https://github.com/eric-maydeck/bean-tracker/commit/a66aa969757b5d2ebab224c399e6161a1a8841a8))
* **lab:** a no-match heatmap cell's tip shows its own brews and bags ([cb3b39e](https://github.com/eric-maydeck/bean-tracker/commit/cb3b39e49027f0a39ef72c266b94f0caed2768d9))
* **pours:** full text of an ellipsized report card name in the shared tip ([8d00743](https://github.com/eric-maydeck/bean-tracker/commit/8d0074346ab8fba7f61209f049a1ac1030f8afb7))
* **pours:** grade findings with the per-bag z, one recipe card, group label ([e448fbd](https://github.com/eric-maydeck/bean-tracker/commit/e448fbdc175ca56280fec4ff938d6c2e7c69ccbb))
* **pours:** keep each Best item on one line ([95d9b1b](https://github.com/eric-maydeck/bean-tracker/commit/95d9b1b0edfb14f01c9f6adb7b33a701051214fd))
* **pours:** keep yeets in the shipped phrase detector ([5921d30](https://github.com/eric-maydeck/bean-tracker/commit/5921d30fb8bfdd33e0ba59400983dce24e797c14))
* **pours:** layout pass, content-height cards, split card, words tables, stacked rest ([2b5a06c](https://github.com/eric-maydeck/bean-tracker/commit/2b5a06c0f22a30ab7d7b46b6619da94530460ce9))
* **pours:** no counts on the No recipe row, empty state checks every section ([5dddb6e](https://github.com/eric-maydeck/bean-tracker/commit/5dddb6e8aa75c2d8daba4f720c9e9de9f0da32b1))
* **pours:** small-sample marker in its own icon column on the report card ([6c1ad15](https://github.com/eric-maydeck/bean-tracker/commit/6c1ad153ef55bbd3cf9405abcf36857f85b3283c))
* **pours:** trend on all-rows basis, precompiled word regexes ([a4cc256](https://github.com/eric-maydeck/bean-tracker/commit/a4cc256309a3e7ab9bca114ff2e62e96034a6b0c))
* **recipes:** note tags help as a hint tip, scope editor Save locators ([48ab772](https://github.com/eric-maydeck/bean-tracker/commit/48ab7728292e620dd40277f2d68f9f9fb7a2cc4e))
* **recipes:** note tags help line ([0337543](https://github.com/eric-maydeck/bean-tracker/commit/03375435e5cd77fa5678afcc67b6e1b4e6710a97))
* **recipes:** reset note words after save, 44px word controls on short screens ([46a9c32](https://github.com/eric-maydeck/bean-tracker/commit/46a9c324fb0b74903bea4ea7d4604165e992d91c))


### Features

* **insights:** pour findings with a cap of three ([55515ba](https://github.com/eric-maydeck/bean-tracker/commit/55515ba43d3883a371b0081f7e15fb414dbb4943))
* **insights:** pours tab with recipe report card, technique, recipe grid and rest ([efe57f0](https://github.com/eric-maydeck/bean-tracker/commit/efe57f0249410b3f47bdb72233176fb8da8bcdca))
* **pours:** agitation labels from recipe, note words and pour speed ([70d64a7](https://github.com/eric-maydeck/bean-tracker/commit/70d64a7f18fa05469df1bee9beeb2879ddd39260))
* **pours:** average mode colored against your overall average ([37badd7](https://github.com/eric-maydeck/bean-tracker/commit/37badd7828f6114cb46757cb4228cbc19cc4d736))
* **pours:** balanced technique columns, padded report card, count tips, ordered words tables ([4f39943](https://github.com/eric-maydeck/bean-tracker/commit/4f3994317e8465f016726a66ba4408902cdb572a))
* **pours:** compare-with switch on recipe by coffee ([4bd2caa](https://github.com/eric-maydeck/bean-tracker/commit/4bd2caa6301aece2982b8e24457f4bda9b886b15))
* **pours:** overall mean and per-cell difference for the average mode ([5c67e03](https://github.com/eric-maydeck/bean-tracker/commit/5c67e036c32757f819aabf57fe621c1af6cf61fb))
* **pours:** pours tab builder on same-bag deltas ([8b5f6e5](https://github.com/eric-maydeck/bean-tracker/commit/8b5f6e5f684887976eb78f8ee75ba1235ed7b3ee))
* **pours:** recipe by coffee means against the row, the recipe and nothing, recipeVs param ([216673b](https://github.com/eric-maydeck/bean-tracker/commit/216673b3780383c59939787d99958084c89067e9))
* **recipes:** words in your notes setting for agitation ([3680582](https://github.com/eric-maydeck/bean-tracker/commit/36805827a72694c27ad8a262a9af16168eb0f4b9))

# [1.97.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.96.0...v1.97.0) (2026-10-28)


### Features

* **recipes:** medium agitation option for recipe pours ([2e50bde](https://github.com/eric-maydeck/bean-tracker/commit/2e50bde82c116e675db220d41392f15db54a97e3))

# [1.96.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.95.0...v1.96.0) (2026-10-28)


### Bug Fixes

* **recipes:** a dripper lock only counts while a recipe is tied to it ([a3f02f3](https://github.com/eric-maydeck/bean-tracker/commit/a3f02f392438fabb787641d5db15306e61c1fb56))
* **recipes:** editor fields no longer overflow at portrait; Note tags on its own row ([b737af8](https://github.com/eric-maydeck/bean-tracker/commit/b737af88037d529c812dc9bfa441173a9f206f5f))
* **recipes:** pour header wraps so a pour fits at 320 px ([328ef36](https://github.com/eric-maydeck/bean-tracker/commit/328ef362894074a65326c815448b6f2def7e9a55))


### Features

* **recipes:** recipe dripper, dripper lock and 'pour speed doesn't matter' ([192ac7a](https://github.com/eric-maydeck/bean-tracker/commit/192ac7a02ee38c17c73401e8ac2d03caca39e534))
* **recipes:** several drippers per recipe, a lock per ticked dripper ([4ee5861](https://github.com/eric-maydeck/bean-tracker/commit/4ee5861dc2d98a1dfd8fc9731ffdd1eabe5e478f))
* **recipes:** show dripper on brew rows, say where hidden structures' brews went ([c7bb987](https://github.com/eric-maydeck/bean-tracker/commit/c7bb98714d7a9348af61db0bd8118e8cfd8fc95a))

# [1.95.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.94.0...v1.95.0) (2026-10-28)


### Bug Fixes

* **csrf:** refused enhanced forms show an error instead of nothing ([f85b3de](https://github.com/eric-maydeck/bean-tracker/commit/f85b3de4efa45258b37620c1d6e811ac3ed2897c))
* **pours:** fast pours need a minimum average speed ([aeb2eda](https://github.com/eric-maydeck/bean-tracker/commit/aeb2edaa9984ba886660cc17e1fb53639739053b))
* **pours:** split recoveries, swing bridges and slow long pours read right ([dabf985](https://github.com/eric-maydeck/bean-tracker/commit/dabf9852cfe90197b9345a065ccc06796ee98613))
* **recipes:** editor keeps the pour range valid, ratio unknown, % timeline, integer counts ([7c73c58](https://github.com/eric-maydeck/bean-tracker/commit/7c73c58065632c6ee0aec1c1f13853c21fd3b7a5))
* **recipes:** one unit toggle for the whole recipe, 44px editor inputs ([f25113c](https://github.com/eric-maydeck/bean-tracker/commit/f25113c5f1354a2366405cf523cca44199affef0))
* **recipes:** seed via vite-node, save error in its form, one recipe spans the row ([eb22c1d](https://github.com/eric-maydeck/bean-tracker/commit/eb22c1d799766ce05fa9f9b04dc99c9131f42683))
* **recipes:** upload survives a reading error, tests and docs tidy ([e78b708](https://github.com/eric-maydeck/bean-tracker/commit/e78b7088b9d3573af5b21f6fd2b573c71aec8573))


### Features

* **pours:** pour detector calibrated on tagged brews ([1a9b2c2](https://github.com/eric-maydeck/bean-tracker/commit/1a9b2c2cfc5ad8096dcfd80df0dfae8cd3531584))
* **pours:** store a pour reading per brew on upload, import and boot ([fb01f74](https://github.com/eric-maydeck/bean-tracker/commit/fb01f744184028b6e272decf47d227936f1474a6))
* **recipes:** bolder swirl lines, 720px page width, other-structures count skips matched ones ([b77c678](https://github.com/eric-maydeck/bean-tracker/commit/b77c6786b57edd8159fceb95a42df581fd4f0c46))
* **recipes:** cumulative-water pour timeline ([2bfa432](https://github.com/eric-maydeck/bean-tracker/commit/2bfa432633dd6072448f2739096cafb82a6f15e6))
* **recipes:** groups need 10 brews, no yeet class, descriptions read as a sentence ([f2072ce](https://github.com/eric-maydeck/bean-tracker/commit/f2072ce3197033799142897b6d209bbf128931c4))
* **recipes:** latest and top rated brew lists, unlisted structure panel, 10-brew seed groups ([7b898c3](https://github.com/eric-maydeck/bean-tracker/commit/7b898c30b254a8b9c206e43ebfbfd2d2a18a2680))
* **recipes:** recipe definitions, matching and discovery groups ([e64b850](https://github.com/eric-maydeck/bean-tracker/commit/e64b850c17ffef2c9259c5926f9572dc94a16e8d))
* **recipes:** recipe editor ([f01b6c1](https://github.com/eric-maydeck/bean-tracker/commit/f01b6c18b3f3e4f9d258db56b024763bb1c8440a))
* **recipes:** recipes page with discovered structures and brew lists ([befedf8](https://github.com/eric-maydeck/bean-tracker/commit/befedf887c14185cfe1979f93fb5293869be3097))

# [1.94.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.93.0...v1.94.0) (2026-10-27)


### Bug Fixes

* **account:** pin csrf hook wiring, clamp flow status, seed step and reveal a11y ([de08213](https://github.com/eric-maydeck/bean-tracker/commit/de08213ed8da47728be9a5918a524b924751385f))
* **account:** say waiting flows need the bean conqueror zip import ([06d1e69](https://github.com/eric-maydeck/bean-tracker/commit/06d1e69714a0d2db9510c95fcef0a26b41f492d6))
* **account:** waiting flows on their own line ([149a2ba](https://github.com/eric-maydeck/bean-tracker/commit/149a2ba6dbb4d4e58e6a809f950b62089d065e09))
* **bc:** case-insensitive basic scheme, strict brew uuid shape ([6596b7d](https://github.com/eric-maydeck/bean-tracker/commit/6596b7d04d1b69a5fd8cdfbf6b875ec7a29f3fc3))
* **bc:** rank flow samples in file order, tighten flow tests ([a0f01cc](https://github.com/eric-maydeck/bean-tracker/commit/a0f01ccaa9eb89927248b9cfd49d96d7fbec7f9a))
* **csrf:** exempt the visualizer upload from the form origin check ([1cb89b1](https://github.com/eric-maydeck/bean-tracker/commit/1cb89b1d0c02b9f7dda5218e610ec40b5ed08bb5))


### Features

* **account:** account page with bean conqueror import and flow upload setup ([90821de](https://github.com/eric-maydeck/bean-tracker/commit/90821de6fb1616731456261483174c7007e16c49))
* **bc:** 50 ms interpolated flow grid with spike keep, 99.3% raw parity ([d0738cb](https://github.com/eric-maydeck/bean-tracker/commit/d0738cb86377b332b8a5fe945497cafe48bb5b5a))
* **bc:** compact flow series with raw-parity tests ([99668be](https://github.com/eric-maydeck/bean-tracker/commit/99668bed2257d97d5ba15d17185b5ac75b4837fa))
* **bc:** store uploaded flow series and the upload password ([55aa9f9](https://github.com/eric-maydeck/bean-tracker/commit/55aa9f9aebfb0a4c12b08f6ad13f1a8d984dbf1c))
* **bc:** visualizer upload, me and shot redirect endpoints ([0d94bbc](https://github.com/eric-maydeck/bean-tracker/commit/0d94bbce21ced2416fb6bda1bd5495c574e76869))

# [1.93.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.92.0...v1.93.0) (2026-10-27)


### Bug Fixes

* **coffee:** favorite grind chip, tap target and timing order ([2cd2442](https://github.com/eric-maydeck/bean-tracker/commit/2cd2442d657a86e9d7dd56c50e38f29c1b78b86f))
* **coffee:** favorite grind column widens, wraps keep dots trailing with a hanging indent ([012bed5](https://github.com/eric-maydeck/bean-tracker/commit/012bed5ea6f7a004e0ea365b3f5a4c7d5191bfb4))
* **coffee:** favorite grind phone tip anchors keep their natural size ([120d8fc](https://github.com/eric-maydeck/bean-tracker/commit/120d8fc55526d170c6948dad3c84e37907cb2258))
* **coffee:** restore the like-coffees grid's auto-fit lost in the timing grid rewrite ([a8e89b7](https://github.com/eric-maydeck/bean-tracker/commit/a8e89b7774252da913c122deeef6250121965990))
* **coffees:** drop a deleted plan's id from the subscription filter ([b7bc467](https://github.com/eric-maydeck/bean-tracker/commit/b7bc467909d3c3bef3a64a2eb7a981b1f3edb16b))
* **insights:** chart keyboard stepping resumes from the last mark ([196f188](https://github.com/eric-maydeck/bean-tracker/commit/196f188ec2861639dd959844f036a62f2522c613))


### Features

* **coffee:** favorite grind drops /10, setting and rating get help tips ([cbe8ab8](https://github.com/eric-maydeck/bean-tracker/commit/cbe8ab85b02695a6141998f6bcba37fedc0bf7ab))
* **coffee:** favorite grind entries as a header and a data line, columns align with the facts grid ([6d5dcd3](https://github.com/eric-maydeck/bean-tracker/commit/6d5dcd3cb9af7b01c4335d3e671c80935708c96b))
* **coffee:** favorite grind per grinder in the timing section ([87299c6](https://github.com/eric-maydeck/bean-tracker/commit/87299c61ce7aaccddeed117d4016fe6984dfdd25))
* **coffee:** favorite grind setting lines as /10 with a text link for the other bag ([19515b9](https://github.com/eric-maydeck/bean-tracker/commit/19515b95ca80529619c182da3863f34935c6807a))
* **coffee:** favorite grind title in Karla 700, "Higher-rated bag" inline as the last segment ([302dcf9](https://github.com/eric-maydeck/bean-tracker/commit/302dcf97cb1dec62d3318814a2eed7045263a040))
* **coffee:** favorite grind title variants f1 and f2 at the data line's size ([394d6b8](https://github.com/eric-maydeck/bean-tracker/commit/394d6b8de5f1fca3cf3f1b64be93cd1da402dbc9))
* **coffee:** favorite grind title variants t1 t2 t3 for the grinder names ([730a733](https://github.com/eric-maydeck/bean-tracker/commit/730a733430b143d4b9bb3e79dfb44180e4afbdd0))
* **coffee:** other-bag indicator on favorite grind, preview variants a and b ([0a43159](https://github.com/eric-maydeck/bean-tracker/commit/0a43159b8ff68523e61b214c9c1f6418fd48fc45))
* **insights:** keyboard and screen-reader reach for chart tip links ([d8cbfa2](https://github.com/eric-maydeck/bean-tracker/commit/d8cbfa2b25dde4482539bc63122aa5f8a196e890))
* **water:** link previews show the recipe's or target's values ([fa55a5a](https://github.com/eric-maydeck/bean-tracker/commit/fa55a5a9633ab3ca7df45e1ebedbd51e08c2f586))
* **water:** recipe and target notes in link previews carry their units ([8311074](https://github.com/eric-maydeck/bean-tracker/commit/83110748a97ccb935a9d4f5c300ab4a005139fb2))

# [1.92.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.91.0...v1.92.0) (2026-10-26)


### Bug Fixes

* **charts:** arrow cursor on chart marks, tips sit at the hovered bar or point ([46f381a](https://github.com/eric-maydeck/bean-tracker/commit/46f381a8a78f454f485641b3101fb15368aff037))
* **charts:** sticky tips on horizontal bars sit above the bar at the pointer ([7c36d17](https://github.com/eric-maydeck/bean-tracker/commit/7c36d17cbdcdb084f41edba2625f6f062d39612e))
* **charts:** tip anchor skips line points, reset over-tip state, keep tip on link-less click ([d547907](https://github.com/eric-maydeck/bean-tracker/commit/d54790778e3bee1a2351f7973bd1648e3a0459be))
* **coffees:** a cost typed between plan fills is the new original ([efa31dc](https://github.com/eric-maydeck/bean-tracker/commit/efa31dc288bb0af6fc9c0bdd37b0ef0ac15ac654))
* **coffees:** place the subscription field in the form grid ([ccdd3c8](https://github.com/eric-maydeck/bean-tracker/commit/ccdd3c89becb95329cae453007294973760dc8c7))
* **insights:** align time to open list columns ([6b7c8f0](https://github.com/eric-maydeck/bean-tracker/commit/6b7c8f044c565a6d4224fcb991339d998c165a0e))
* **insights:** cap value map x ticks at 5, keyboard test, honest exemption note ([3fefaea](https://github.com/eric-maydeck/bean-tracker/commit/3fefaeacd7fb3fc04fca1f9bf48b703466282ba6))
* **insights:** freshness review fixes ([f29a6d4](https://github.com/eric-maydeck/bean-tracker/commit/f29a6d46482b01ef20b9d5ffac8806050ccc818e))
* **insights:** in the freezer count never reads per person, only its grams ([7d2dba3](https://github.com/eric-maydeck/bean-tracker/commit/7d2dba3e5074179565cd3727ffa4df9fd83cbe9e))
* **insights:** keep the free-bag caption under the compare delta ([739b478](https://github.com/eric-maydeck/bean-tracker/commit/739b4789c8d6c431e58f2bf32bcd3d75fbe2dfa2))
* **insights:** money ticks on the spend chart ([fe63e4b](https://github.com/eric-maydeck/bean-tracker/commit/fe63e4b84b5238446f803a6e073edd2728b13df7))
* **insights:** on hand junk roast dates, unknown origin link, thaw note ([cb02ad2](https://github.com/eric-maydeck/bean-tracker/commit/cb02ad279c59e011642caf75af8792bf32886661))
* **insights:** on hand waitBy default stays out of the url, runway help text ([f92b7de](https://github.com/eric-maydeck/bean-tracker/commit/f92b7de440578b6c02e784c869ded3c0e6165aba))
* **insights:** overview days open count from the first brew ([a7d07af](https://github.com/eric-maydeck/bean-tracker/commit/a7d07afe09bb828c2994b4c5d98880462d01b7b0))
* **insights:** per-series average compare lines, no all-Other share, popstate keeps its scroll ([1b2481e](https://github.com/eric-maydeck/bean-tracker/commit/1b2481e83266c1dd1c58dac6c029f4bdf83771e8))
* **insights:** plan rating counts all brews of Period bags ([8dac4b6](https://github.com/eric-maydeck/bean-tracker/commit/8dac4b65cb6d59111b4d320329713c810b61b766))
* **insights:** prior wording, thicker dashed lines, sorted share legend and tips, tab scroll restore ([72be7af](https://github.com/eric-maydeck/bean-tracker/commit/72be7af26be30e95efd9644f6f5733ca53f301a3))
* **insights:** rating tile caption keeps calibrated ratings, all brews together ([1982d8a](https://github.com/eric-maydeck/bean-tracker/commit/1982d8af6a9d84a48556bb0beb02f00a7c458249))
* **insights:** report card columns keep their widths across sorts ([ef9c576](https://github.com/eric-maydeck/bean-tracker/commit/ef9c57645e15cbdc62b90f4e7bd4b0a19f628ebb))
* **insights:** report card review fixes ([8805cbe](https://github.com/eric-maydeck/bean-tracker/commit/8805cbef56c89f7e6181ef3cdd5fa49586a0f493))
* **insights:** roaster discovery tip drops the unit, plot keeps the arrow cursor ([b232139](https://github.com/eric-maydeck/bean-tracker/commit/b23213969cf0d0ccdba8e34365520b094291d56a))
* **insights:** runway rows stay three across at 360, tile size check vs the shelf ([3842a4f](https://github.com/eric-maydeck/bean-tracker/commit/3842a4f4c194988c17a9f5b8ed234d7c1b0110b4))
* **insights:** space before vs in plan figures, with ui assertions ([684b0e4](https://github.com/eric-maydeck/bean-tracker/commit/684b0e4df6c33583c25f3d9a147d644f672de9f2))
* **insights:** spend chart buckets start at the first roast date ([aa1236f](https://github.com/eric-maydeck/bean-tracker/commit/aa1236f29a47b8bdfa7505121b90b8a7cf8df44e))
* **insights:** spend tiles: no tip on no change, value tips keep the arrow, bags never divide ([1ee2fe5](https://github.com/eric-maydeck/bean-tracker/commit/1ee2fe5dcc1b5ffef36d8305b7c4857db3a0e096))
* **insights:** spending tiles three across on phones, underline clear of digits ([d9c6033](https://github.com/eric-maydeck/bean-tracker/commit/d9c603381a3aabfd13f9341a592339250554d00f))
* **insights:** tile caption keys, runway note only per person, stale comments ([2bcf6b7](https://github.com/eric-maydeck/bean-tracker/commit/2bcf6b7c22b6e2c24004bccb5346077299c6d9fc))
* **insights:** tile caption parts on their own line, titles never move ([82e8c78](https://github.com/eric-maydeck/bean-tracker/commit/82e8c78e62a53263579d715b7f87df1ca150b0c4))
* **insights:** tile titles stay put when per person adds a caption part ([8bc99bd](https://github.com/eric-maydeck/bean-tracker/commit/8bc99bd8ecadde3f896274895049546eaacfd0ce))
* **insights:** value map rounds money to cents; shorter low-confidence note ([7a15d17](https://github.com/eric-maydeck/bean-tracker/commit/7a15d170d0da07fe4acf753a68224ef689b4541d))
* short subscription comparison lines on phones, pill legend, coffee Back is history back ([92bcdd9](https://github.com/eric-maydeck/bean-tracker/commit/92bcdd92bffa657db04374e5e6f47702e0c60b18))
* **stats:** keep rested and ready, validate freeze dates, sort undated bags last ([c06727b](https://github.com/eric-maydeck/bean-tracker/commit/c06727b9b9ff02a844efdefb47a53240b2c6a920))
* **subscriptions:** log how many subscription links applied ([d9748e4](https://github.com/eric-maydeck/bean-tracker/commit/d9748e4e27c27632763f9b85c12b19ed9660a9f0))
* **subscriptions:** pre-migration-safe candidate query, multi-plan merge, clearer lines ([19a048a](https://github.com/eric-maydeck/bean-tracker/commit/19a048abab30b2dfaa65df9bd7e48777f331f6a0))
* **ui:** caption lists re-place when their items or text change in place ([f8d5988](https://github.com/eric-maydeck/bean-tracker/commit/f8d59885f68c48bff355f09e5816a87bc3dc7838))
* **ui:** per-list caption observers and dot width, drop dead caption css ([99322c6](https://github.com/eric-maydeck/bean-tracker/commit/99322c6d96e3cef860d37fa8032ec0829ae4e0dd))


### Features

* **coffees:** fill a bag's cost from its subscription plan ([7ab7201](https://github.com/eric-maydeck/bean-tracker/commit/7ab7201137672f602a73b15b79f2c2680b7a389f))
* **coffees:** none restores the cost from before the plan filled it ([800a5fc](https://github.com/eric-maydeck/bean-tracker/commit/800a5fcccbb999f9a4d9052758b703964f4c8f32))
* **coffees:** pick a bag's subscription on the edit form ([2cf9dcd](https://github.com/eric-maydeck/bean-tracker/commit/2cf9dcd4ddaae3c150a297e44cf7ff25ea46262b))
* **coffees:** rest state and age filters, exact age profile links ([cd20607](https://github.com/eric-maydeck/bean-tracker/commit/cd20607c6f8846f25b369dc35bdea5445c91acdc))
* **coffees:** subscription filter and bag-count links from the spend subscriptions panel ([33a5572](https://github.com/eric-maydeck/bean-tracker/commit/33a5572f51d05375c850c89cdc78cd47b828e6eb))
* **coffees:** subscription label shows roaster and size, plus a view-mode stat ([ae894e8](https://github.com/eric-maydeck/bean-tracker/commit/ae894e8d39f87d039f8f5e6a75966bd5b5112e12))
* **insights:** age profile of waiting bags ([2e39fd6](https://github.com/eric-maydeck/bean-tracker/commit/2e39fd6c4eb2a0b8787d5694fd5411c55581a790))
* **insights:** age profile tips link to the segment's coffees, contrasting past color ([11cdec4](https://github.com/eric-maydeck/bean-tracker/commit/11cdec4c7b589c7c29a50e87a23820e457cca817))
* **insights:** freshness history on over time ([e80145a](https://github.com/eric-maydeck/bean-tracker/commit/e80145ad35ebff6572f1d91abeb51c1c328486ad))
* **insights:** freshness overflow links to the group's coffees ([4db9d29](https://github.com/eric-maydeck/bean-tracker/commit/4db9d296febaf74b2913ba4fabfc9daed4a6b3a8))
* **insights:** on hand second in summary, spend in habits, no spend group ([020a676](https://github.com/eric-maydeck/bean-tracker/commit/020a6760769d0988a9014d2d57f28b1152069fdf))
* **insights:** on hand tab with tiles, runway and freshness ([257576d](https://github.com/eric-maydeck/bean-tracker/commit/257576d7601365d8d6481f3ce7629e19dac1af06))
* **insights:** over time tab and its url state ([49c6164](https://github.com/eric-maydeck/bean-tracker/commit/49c6164c91386a22bf91addcce9ea6d0fe987397))
* **insights:** over time tab with spend tiles ([58e440a](https://github.com/eric-maydeck/bean-tracker/commit/58e440a3deccea1bdd86195e5e208b6d5cf5a5d6))
* **insights:** repeat-buy by 2+ bags, wider share of spend with dollars, nearest-x discovery tip ([4a5f31b](https://github.com/eric-maydeck/bean-tracker/commit/4a5f31bc4e548033b818fb23f4ea32fafaaf2be8))
* **insights:** roaster discovery and share of spend ([e342f25](https://github.com/eric-maydeck/bean-tracker/commit/e342f25b33bb75b91db2dda418fc8058d31710a2))
* **insights:** runway as stat tiles with a projection chart ([b00a631](https://github.com/eric-maydeck/bean-tracker/commit/b00a631c318cdc688adf8b1b698707eea2977bd3))
* **insights:** runway as two labelled rows of three tiles ([1b2814a](https://github.com/eric-maydeck/bean-tracker/commit/1b2814a417250f8f9dd4d026b9baf058a42eb7a1))
* **insights:** share of spend names every repeat roaster the palette allows ([6852066](https://github.com/eric-maydeck/bean-tracker/commit/685206612efdea9fcb8b3d1e68bbb7df4b29f99d))
* **insights:** share of spend tips list every roaster; legend isolates one ([a8c3537](https://github.com/eric-maydeck/bean-tracker/commit/a8c3537a88c8042c5644226b5b8a28eda43ee30e))
* **insights:** sortable roaster report card ([01900be](https://github.com/eric-maydeck/bean-tracker/commit/01900be8d5e3d07aea897ed1902cdb6de428ee12))
* **insights:** spend chart colors per selection, period-grouped tips, nearest x on lines ([f33965c](https://github.com/eric-maydeck/bean-tracker/commit/f33965cd0e4c74c21937a3f007326494e9bfc4c4))
* **insights:** spend chart series selector, split compare window, entity colors ([b3dac47](https://github.com/eric-maydeck/bean-tracker/commit/b3dac47c3dc87a6a073ac361b3a7dcc869bf6b9f))
* **insights:** spend over time by subscription and one-off ([b352880](https://github.com/eric-maydeck/bean-tracker/commit/b352880c404596b18d096029240580c6782c2a23))
* **insights:** spend tips with offset headers, row symbols and No data; true gaps in the $/g lines ([e6ec648](https://github.com/eric-maydeck/bean-tracker/commit/e6ec6481e54fb2ab08a5fc7bb2afb3334127f26e))
* **insights:** subscriptions panel: roaster in the name, labeled cost and rating lines ([0399d22](https://github.com/eric-maydeck/bean-tracker/commit/0399d224b74c917c02bc2e05e02b91ff6529e6e8))
* **insights:** subscriptions value panel ([acae54a](https://github.com/eric-maydeck/bean-tracker/commit/acae54afe577832959fc659303b90a03b70a75d1))
* **insights:** value map and best value coffees ([1fd5a3a](https://github.com/eric-maydeck/bean-tracker/commit/1fd5a3a4d68e48b0d73c09003f16e7d6fc570b35))
* **insights:** value map click pins the tip instead of navigating ([1b8cad7](https://github.com/eric-maydeck/bean-tracker/commit/1b8cad760e6bed05168cb1673c04bc430ac14cc0))
* **insights:** value map hover tip has the link, stays open for the pointer, pins in place ([1142d1d](https://github.com/eric-maydeck/bean-tracker/commit/1142d1d21c18a3049e2cc1ae0041d594c2e31307))
* **insights:** what's waiting by roaster, origin, process, roast ([2c44dfc](https://github.com/eric-maydeck/bean-tracker/commit/2c44dfc8720de2eb3e302ceecbf91defe1e874c9))
* **insights:** what's waiting tips link to the group's coffees ([d9fe35d](https://github.com/eric-maydeck/bean-tracker/commit/d9fe35d3db5205f388561ab24c0dc316024dc67f))
* **subscriptions:** boot migration that links confirmed subscription bags ([c0f9a4b](https://github.com/eric-maydeck/bean-tracker/commit/c0f9a4b9b1e6d393b68edb25ddfff69e76d22c91))
* **subscriptions:** link the confirmed subscription bags ([d53f612](https://github.com/eric-maydeck/bean-tracker/commit/d53f61273e38c4905eb1e0ec85c94564d91fdc0b))
* **subscriptions:** list likely subscription bags for the backfill ([d88b0a1](https://github.com/eric-maydeck/bean-tracker/commit/d88b0a1571dafffef4f17a7542c0b76de54e01df))
* **subscriptions:** store which plan a bag came from ([6ec999b](https://github.com/eric-maydeck/bean-tracker/commit/6ec999bb49d54a67547a20bc16c0ce1f8cad587d))
* **ui:** caption block below the title, css-only hanging dots with exact spaces ([3501f2e](https://github.com/eric-maydeck/bean-tracker/commit/3501f2e9b50ff7443112e659ea12510030b0eb2d))
* **ui:** centered caption lines, shared script hides line-start dots ([574b37a](https://github.com/eric-maydeck/bean-tracker/commit/574b37aae49d2d4aeed39a3ac11a94c570f38837))
* **ui:** tile caption items flow inline with a hanging dot, none starts a line ([9d661d4](https://github.com/eric-maydeck/bean-tracker/commit/9d661d400f6e34830ace2ce7ecc2449d9d7598bd))

# [1.91.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.90.0...v1.91.0) (2026-10-26)


### Features

* **previews:** top brews show roaster and coffee only, fitting five ([d14246d](https://github.com/eric-maydeck/bean-tracker/commit/d14246d3774b6b1554e1d41ef1f6fff5ecf77962))

# [1.90.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.89.0...v1.90.0) (2026-10-25)


### Bug Fixes

* **share:** copy when an unsettled share sheet blocks the next share; each copy restarts the label ([16b2c99](https://github.com/eric-maydeck/bean-tracker/commit/16b2c9968e9a28f911f3d2fc295aeee7d17bfaab))


### Features

* **insights:** ranked previews, top lists, records sections and tiles; tile links own their id ([6b53701](https://github.com/eric-maydeck/bean-tracker/commit/6b537010af9da4821bf33506ce4c1809fa200ae6))
* **previews:** coffees preview as status, filters, then count and weight ([8491c2a](https://github.com/eric-maydeck/bean-tracker/commit/8491c2abd56b1363f1ad13f6af0cbd39032f37b8))
* **previews:** page-level insights and stats previews lead with an owner-named summary ([666a5a1](https://github.com/eric-maydeck/bean-tracker/commit/666a5a10461ffa1e61909be5d6ccac628875ac05))
* **previews:** water and subscriptions as one fact per line; coffee shows amount left ([3a3b3a6](https://github.com/eric-maydeck/bean-tracker/commit/3a3b3a6a43955b4b841d1bddca23fd7ab92abf40))

# [1.89.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.88.0...v1.89.0) (2026-10-25)


### Bug Fixes

* **insights:** any view change drops chart from the url ([f1c813e](https://github.com/eric-maydeck/bean-tracker/commit/f1c813ebcde867a2de63a374bce37812b12e921d))
* **insights:** center the map hint above the zoom buttons ([b76a839](https://github.com/eric-maydeck/bean-tracker/commit/b76a839eda70f97849ce9d5e7ea2debabed2d76f))
* **insights:** chart hash follows the chart, scroll after the load settles ([2a19547](https://github.com/eric-maydeck/bean-tracker/commit/2a19547784113ccd1f2ce17c341e1e6d276f12bf))
* **previews:** dash between chart label and value, roaster first, no 0 x 0g ([9086fd2](https://github.com/eric-maydeck/bean-tracker/commit/9086fd2154b0971da87d22e31bec1fcd5ac63c3b))
* **previews:** one list item per line, middle dot between an item's details ([e2fcff8](https://github.com/eric-maydeck/bean-tracker/commit/e2fcff8fd250faaf7d85b7460682a88f12c66fda))
* **ui:** hide back to top while it would cover a map's zoom buttons ([82eee0e](https://github.com/eric-maydeck/bean-tracker/commit/82eee0e455349690779f95a2f5b526b0bff9e8f1))


### Features

* **insights:** 1:50m world outlines aligned to the 110m map ([6a1a11e](https://github.com/eric-maydeck/bean-tracker/commit/6a1a11eca881074514ac57027377533d4b957616))
* **insights:** chain-link icon on heading links ([0f3d017](https://github.com/eric-maydeck/bean-tracker/commit/0f3d01731b9a4608805b72ad66153e354979b129))
* **insights:** link previews with chart data as text ([ebc3e4b](https://github.com/eric-maydeck/bean-tracker/commit/ebc3e4b952e0b9df609c75526f643a546ffe1b2f))
* **insights:** pinch, two-finger pan, ctrl-wheel zoom and map hints ([059a4ff](https://github.com/eric-maydeck/bean-tracker/commit/059a4ffb666b46a2ea1d576d3c673d6d77a56367))
* **insights:** section heading links carry chart= in the address bar ([4c28e11](https://github.com/eric-maydeck/bean-tracker/commit/4c28e11ff556fe1add443a43e0cf7ab0f6c965eb))
* **insights:** zoom and pan the origin map with buttons and mouse drag ([db43c4b](https://github.com/eric-maydeck/bean-tracker/commit/db43c4b35defc8e2ecac6d1bacc1ca0ea429a050))
* **previews:** link preview text builders ([7ff5b14](https://github.com/eric-maydeck/bean-tracker/commit/7ff5b145028fc4e92fec98c8ed902abaedca9e7f))
* **previews:** open graph tags and the coffee page preview ([f982877](https://github.com/eric-maydeck/bean-tracker/commit/f9828775b61018afb949c7a321939b791521b125))
* **previews:** page previews for coffees, on deck, subscriptions, stats and water ([280d121](https://github.com/eric-maydeck/bean-tracker/commit/280d1216c41eb8a3bc4d93e8699ce32f54f9aa60))

# [1.88.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.87.0...v1.88.0) (2026-10-25)


### Bug Fixes

* **insights:** clear the see-all tip's tap area from the period line on phones ([fcded3a](https://github.com/eric-maydeck/bean-tracker/commit/fcded3ac610ae59d7e56040703965ce1b7e7bdb5))
* **insights:** milestones, tips and ratings menu follow the pinned row ([9312cb4](https://github.com/eric-maydeck/bean-tracker/commit/9312cb477b240a5e2832aefcc21a7756c686e956))
* **insights:** no media-query gap for inner mode, untracked init, safe hash decode ([8e147d8](https://github.com/eric-maydeck/bean-tracker/commit/8e147d89eeac8b395e2f12ebc2f3482f3bda763c))
* **insights:** pull tab attached to the bar, Back to top stays tappable behind it ([b2a9027](https://github.com/eric-maydeck/bean-tracker/commit/b2a90276b0e8eba1694bba2c86a675e2bb49a46f))
* **insights:** pull tab is the expand caret's box, flush under the bar ([8582178](https://github.com/eric-maydeck/bean-tracker/commit/858217831c015985985c4d997e2c93fa9a01584f))
* **insights:** short see-all note on phones, on its own line so toggling moves nothing ([ecd9a41](https://github.com/eric-maydeck/bean-tracker/commit/ecd9a419bda4a35caefa46d3fe2bcd2185824c21))
* **insights:** switched chart notes keep a fixed sentence and suffix line ([7de9d12](https://github.com/eric-maydeck/bean-tracker/commit/7de9d12a5a232c50d75f84bfebf72b5ceca4ba6b))
* **insights:** tap tips in the open bar don't scroll the page ([8e94391](https://github.com/eric-maydeck/bean-tracker/commit/8e94391db24917b83a3d1c6e742274e8dceaf7f8))


### Features

* **coffees:** pull-tab fold caret; collapsible bar inner mode ([178a8fe](https://github.com/eric-maydeck/bean-tracker/commit/178a8fe2763b8c20743a63cca568244bea956d6e))
* **insights:** collapsible control block on phones ([6ae0139](https://github.com/eric-maydeck/bean-tracker/commit/6ae01390f506080c3239ba659c5aaeca08487c88))
* **insights:** escape folds the open control bar ([e4865c0](https://github.com/eric-maydeck/bean-tracker/commit/e4865c0331b6509ded29405c0a18b8a80375fc00))

# [1.87.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.86.0...v1.87.0) (2026-10-24)


### Bug Fixes

* **coffees:** expanded caret is a css item of the last row, no measuring ([7f31f35](https://github.com/eric-maydeck/bean-tracker/commit/7f31f35dc4cbfb12ae63c42a2eab9fa63f10e172))
* **coffees:** expanded caret lines up with its left neighbor button ([c1f83ee](https://github.com/eric-maydeck/bean-tracker/commit/c1f83ee41f6519173ec5c153a47f6913a13b43d6))
* **coffees:** only the show row gives up space for the caret in portrait ([0cc840e](https://github.com/eric-maydeck/bean-tracker/commit/0cc840eb6b82291a1dce4a44b2e601c61ed6f930))
* **coffees:** save and discard labels keep their space, show and view fill rows, caret top right ([bb43e6c](https://github.com/eric-maydeck/bean-tracker/commit/bb43e6cf0d29a31d3242295404ad88182b6909b1))
* **coffees:** scope phone toolbar button padding to the coffees bar ([be4afe3](https://github.com/eric-maydeck/bean-tracker/commit/be4afe3a1323551022b2d37dd1219921500f1f3b))
* **ui:** discard image is ghost red ([dd681e6](https://github.com/eric-maydeck/bean-tracker/commit/dd681e6c9917b468d6494943111e4b84c5f4b105))


### Features

* **coffees:** caret in muted gray-brown, preview params removed ([84d54f4](https://github.com/eric-maydeck/bean-tracker/commit/84d54f4452e9adfff3575525c1edcd27cadda36f))
* **coffees:** expanded caret moves to the end of the last row, add centered on phones ([2319829](https://github.com/eric-maydeck/bean-tracker/commit/231982970a7b5341bffbab1935dedfaf501f708b))
* **coffees:** pinned control bar with phone collapse, sort beside add, 3+3 edit row ([0017f1f](https://github.com/eric-maydeck/bean-tracker/commit/0017f1fc7c652378bec8ad00fba8bdade0321139))
* **coffees:** sort at the row end beside results and add, caret on the show line ([6cd46dd](https://github.com/eric-maydeck/bean-tracker/commit/6cd46dd98de468d978f6d024b824c476cc35add2))
* **coffees:** sort by dropdown with asc/desc toggle, share last, phone button row spans search box ([9450cfb](https://github.com/eric-maydeck/bean-tracker/commit/9450cfbaf1df07aef5e64c3bc1c0e55764ee92ec))
* **coffees:** sort by label inline left of the dropdown on desktop ([ff6c592](https://github.com/eric-maydeck/bean-tracker/commit/ff6c592ec1c622b82a4fbdd2e749a3395b773e0a))
* **coffees:** tighter control bar gaps, caret in the show row, view and sort on one line ([9d396a4](https://github.com/eric-maydeck/bean-tracker/commit/9d396a48c2cb47acb3e5eec7dfdeda1a48ac4f34))
* **ui:** discard changes is tonal red everywhere ([d5a3cbd](https://github.com/eric-maydeck/bean-tracker/commit/d5a3cbd15d8989cd78227e019588586d83547269))

# [1.86.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.85.0...v1.86.0) (2026-10-24)


### Bug Fixes

* **charts:** dark-mode dark brown between the two tried shades ([5b38399](https://github.com/eric-maydeck/bean-tracker/commit/5b383994b0f73690e1983938504ae903d78ec312))
* **charts:** darker outline on brown bars ([3361ea9](https://github.com/eric-maydeck/bean-tracker/commit/3361ea930b0b8a0e4f4bdc233d1250d44d1b9779))
* **charts:** deeper dark-mode dark brown so the trend line stands out ([499fd20](https://github.com/eric-maydeck/bean-tracker/commit/499fd20dab521c23bc9f9da09e9976cf268cc03b))
* **charts:** draw trend lines above the bars ([0c74c2e](https://github.com/eric-maydeck/bean-tracker/commit/0c74c2e2f40ebb8f43c81b819b7520e853eda303))
* **charts:** near-black outline on dark-mode compare bars ([bb5312d](https://github.com/eric-maydeck/bean-tracker/commit/bb5312d1fa178cf92438ec36e7dbfea78d3a4f7b))
* **charts:** thinner bar outlines ([224d9ff](https://github.com/eric-maydeck/bean-tracker/commit/224d9ffc39ac7f3e777758b0b68685d7ce7ff0ad))
* **insights:** fold into Other only when 2+ items would go there ([b1f9946](https://github.com/eric-maydeck/bean-tracker/commit/b1f9946540fa1ca38251487e4df7901b774cb3c0))
* **insights:** greyed ratings menu and show stay put so switching modes never moves the page ([e9cd350](https://github.com/eric-maydeck/bean-tracker/commit/e9cd350b72f99a60f22c8e6c2cb0e99b44d2691d))
* **insights:** measure titles keep one header width so switching never rewraps ([587ac1d](https://github.com/eric-maydeck/bean-tracker/commit/587ac1d10f25d2d11df1399c96a87c496e2154b7))
* **insights:** rule 42 line colors, trend chart styling, see-all note in the period row ([6bab430](https://github.com/eric-maydeck/bean-tracker/commit/6bab430dc5046664fd979405e9af84a4faff6476))
* **insights:** see-all note shares the period line on phones, no held empty line ([95a79c3](https://github.com/eric-maydeck/bean-tracker/commit/95a79c3fd10100138db7491d45b1016d13cd52dd))
* **insights:** tips above the plot, thick usage lines, see-all note type ([bb56582](https://github.com/eric-maydeck/bean-tracker/commit/bb56582684e2545460441b9effccf01915174724))


### Features

* **charts:** legends below the plot on every chart ([0006350](https://github.com/eric-maydeck/bean-tracker/commit/00063504ba42109fe813c664dff1658cfa55abe8))
* **charts:** see-through bars with an outline on every bar chart ([a50acc2](https://github.com/eric-maydeck/bean-tracker/commit/a50acc2c639636cf9e3f153b39ac800fdcca9d06))
* **insights:** brewed-over-time measures, per brew day and grinder usage ([70a394b](https://github.com/eric-maydeck/bean-tracker/commit/70a394b86f4b74112dd1bf8aec6be795f4806aa1))
* **insights:** light, medium and dark browns for 1-3 series, lines included ([c08fe0b](https://github.com/eric-maydeck/bean-tracker/commit/c08fe0bf22040797187404047a0837c38a1dc377))
* **insights:** one line style for every chart, trend counted as a series ([395ad9d](https://github.com/eric-maydeck/bean-tracker/commit/395ad9d4ad34a51e48c48188b8b370273cfab9b8))
* **insights:** one usage-chart view param per chart ([5faf35a](https://github.com/eric-maydeck/bean-tracker/commit/5faf35ae24837f9908b9e4c1b1587a6d05544e45))
* **insights:** trend toggle, usage bars or lines and per brew day on the insights tabs ([0a4d37d](https://github.com/eric-maydeck/bean-tracker/commit/0a4d37d71451581f64ff8b5cac15db43c9dbb77c))
* **insights:** url params for trend measure, per brew day and usage views ([1b134a9](https://github.com/eric-maydeck/bean-tracker/commit/1b134a92e801aa8f4184fbe94c2561fc9e4208e7))

# [1.85.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.84.0...v1.85.0) (2026-10-23)


### Bug Fixes

* **ci:** pin svelte-check as a devDependency ([a7f59dd](https://github.com/eric-maydeck/bean-tracker/commit/a7f59dd3e6da9b472f5aea7e4bf3dbc1f209aa66))
* **gear:** disabled step size looks disabled ([4f70a46](https://github.com/eric-maydeck/bean-tracker/commit/4f70a4684398659148a19387ad2b74fe6f63efa5))
* **gear:** fill errors read message, save waits for fill, cover image and error replies ([761a98e](https://github.com/eric-maydeck/bean-tracker/commit/761a98e687035af6a4d42c59aad140dc3dcd1f9c))
* **gear:** fill keeps an options field only when it matches an option ([26a423f](https://github.com/eric-maydeck/bean-tracker/commit/26a423fd819e414a88205b28b5f5c4c2032b3800))
* **gear:** fill never reads a brew temperature as the cone angle ([7aaed4e](https://github.com/eric-maydeck/bean-tracker/commit/7aaed4e80c0b22e4ccc8b8908aa3aca68fdd3c41))
* **gear:** final review fixes (bad number input, raw names, remembered card, tidy) ([a10808c](https://github.com/eric-maydeck/bean-tracker/commit/a10808c99e64f748b2bd9fb0c06460b32dd40a3a))
* **gear:** keep seeded coffee brew counts, tidy trophy styles ([d17da34](https://github.com/eric-maydeck/bean-tracker/commit/d17da3449731a6d35098a691309d92bdebd90475))
* **gear:** keep the svelte-ignore on the values state ([da5a09d](https://github.com/eric-maydeck/bean-tracker/commit/da5a09d6bee24f74a2f43684c0746db003069d24))
* **gear:** number inputs no longer break the unsaved-changes check ([9882365](https://github.com/eric-maydeck/bean-tracker/commit/9882365258ab1aff961e1b8cb389df6b5867d9b4))
* **gear:** reset edit form on card change, block repeated escape ([4834a22](https://github.com/eric-maydeck/bean-tracker/commit/4834a220163f1e71af14a915f83610325361586b))
* **gear:** suggest beside preview, disabled fill look, space above actions, money cents ([88dc06e](https://github.com/eric-maydeck/bean-tracker/commit/88dc06ebebce3e1207f93972ef88eeafb01babe4))
* **gear:** unsaved-changes panel inside the dialog instead of confirm ([86cf7fc](https://github.com/eric-maydeck/bean-tracker/commit/86cf7fc52e4cebaf9da70a0e72beff14a30fb60c))
* **images:** narrow the dialog skip in the button-row check, scope the suggest button rules ([03d9cae](https://github.com/eric-maydeck/bean-tracker/commit/03d9caeb4ec5f46faa5a9b11f83f15c886db8394))
* **insights:** latch the temp trophy style on mount ([3ee0b88](https://github.com/eric-maydeck/bean-tracker/commit/3ee0b8821df99aeef40b641d7f750a6b1683fd58))
* **insights:** trophy dialog heading scale matches the coffee page ([2376fb2](https://github.com/eric-maydeck/bean-tracker/commit/2376fb2eae56e072e60b16ecfd8918fa3ca7aacc))
* **insights:** unique jump ids, heading-text chip labels ([446592e](https://github.com/eric-maydeck/bean-tracker/commit/446592e0c7d53c267e27cc7603c583568d0f59f5))
* **stats:** link picker action row sits 16px below the picker ([413339b](https://github.com/eric-maydeck/bean-tracker/commit/413339bc5201f06b7905eedd8dc27ee0d4d768fd))
* **tips:** a scroll under a still mouse never opens a help tip over the pinned headline tip ([86d3d7e](https://github.com/eric-maydeck/bean-tracker/commit/86d3d7e3230940b05794775e3923e154dc3e3381))
* **tips:** ignore a pointerover only when the pointer has not moved, not a scroll time window ([f961bdb](https://github.com/eric-maydeck/bean-tracker/commit/f961bdbffd8d079a63133ef4b0336a9086a2e65a))


### Features

* **gear:** a card with no stored details says so ([aba64ac](https://github.com/eric-maydeck/bean-tracker/commit/aba64ac0129aa5e71664e383d9938cf48c57d4ec))
* **gear:** added date defaults to Bean Conqueror created date or first brew ([d134249](https://github.com/eric-maydeck/bean-tracker/commit/d1342497c68154540eaec9fce03060dfcdf10622))
* **gear:** admin edit form on trophy cards ([c88c470](https://github.com/eric-maydeck/bean-tracker/commit/c88c4709fae0852d01599d7daa950d4d051c36c2))
* **gear:** admin endpoint to save gear details ([5e034cb](https://github.com/eric-maydeck/bean-tracker/commit/5e034cbc6a9147234d2262b1b60a07c5be7a7aa6))
* **gear:** aligned edit grid, gear tab jump links ([4977101](https://github.com/eric-maydeck/bean-tracker/commit/4977101b5d842fdc595f84a2f6abc77fe9ef2b7c))
* **gear:** brew and rating facts join Usage as an aligned second row, with avg dose ([db36a76](https://github.com/eric-maydeck/bean-tracker/commit/db36a76f86c863a04f1fc105f021b6ecd9afbc8f))
* **gear:** close button leaves edit mode with an unsaved-changes prompt ([8e2e693](https://github.com/eric-maydeck/bean-tracker/commit/8e2e6935efbb72ceeb24094762c8673320a0931c))
* **gear:** compact edit grid, reordered image row, save placement latch ([4b042e4](https://github.com/eric-maydeck/bean-tracker/commit/4b042e400f20fbf54d0942a678bbec4a738c4176))
* **gear:** field help tips, burr coating, earliest added with time ([04fd6d8](https://github.com/eric-maydeck/bean-tracker/commit/04fd6d8df1e3fb2e7fcaf786a73f1e0c6932e425))
* **gear:** fill from url and image suggest for gear ([286f81a](https://github.com/eric-maydeck/bean-tracker/commit/286f81a2e18839f1e70c936e40b4570dcc98db67))
* **gear:** fill gear details from a product page ([35e4f39](https://github.com/eric-maydeck/bean-tracker/commit/35e4f3993c42307eefaf08d03a4e6e15ad5bf2c2))
* **gear:** fill reads option specs from the page's prose when no spec line has them ([e7c2364](https://github.com/eric-maydeck/bean-tracker/commit/e7c2364ca04eceeb1f7eec7832c8326abc17a807))
* **gear:** grinder adjustment select, one-line browser-zone stamps, tip wording ([8be28e0](https://github.com/eric-maydeck/bean-tracker/commit/8be28e056c3bb2b4471bd84051885e7681097533))
* **gear:** local copies and backdrops for gear images ([2cf03a6](https://github.com/eric-maydeck/bean-tracker/commit/2cf03a61e10a08c5761812a805e4a90b9e91e730))
* **gear:** official website sits under Fill from URL, cost beside model ([67163f3](https://github.com/eric-maydeck/bean-tracker/commit/67163f34eb72025c5e379db50b4eea3ab8de5f0f))
* **gear:** overlay dialog actions, edit image row under photo, one-line usage ([e6208f4](https://github.com/eric-maydeck/bean-tracker/commit/e6208f44524275c05ebd51291bd6e47ace76fd62))
* **gear:** per-kind metadata standard and validation ([1da0556](https://github.com/eric-maydeck/bean-tracker/commit/1da05564951947fec8a980be31c77ac506acbc84))
* **gear:** save pair spans last input, dripper field help tips ([3288a2f](https://github.com/eric-maydeck/bean-tracker/commit/3288a2fc7e67545017ab41dc6455af4ccbff8ab4))
* **gear:** stored gear details on trophy cards ([fea7632](https://github.com/eric-maydeck/bean-tracker/commit/fea763298c100e43bc18a64ac577dd9bcff914d5))
* **gear:** trim store suffixes from the filled brand ([8a88883](https://github.com/eric-maydeck/bean-tracker/commit/8a88883d0952b1b14aa0e9f8dd6c8adef0c65f43))
* **gear:** trophy dialog header actions, full-width usage, square card photos ([835feb9](https://github.com/eric-maydeck/bean-tracker/commit/835feb9d00479f399b662263259353e0b9feaab4))
* **insights:** cards and retired url params for the trophy case ([06dcf51](https://github.com/eric-maydeck/bean-tracker/commit/06dcf516e81df04a217c60b9f3c49c72dc0d78c3))
* **insights:** gear names in roast brown ([ad77f35](https://github.com/eric-maydeck/bean-tracker/commit/ad77f35bb8a63739f5e7024a7d5b0160c6c19990))
* **insights:** gear showcase cards lead with the average and the name ([692bb76](https://github.com/eric-maydeck/bean-tracker/commit/692bb76bab4194b130a02f16e26cb85d43679a96))
* **insights:** gear showcase follows the period, kind toggle, name headline ([8518a99](https://github.com/eric-maydeck/bean-tracker/commit/8518a99b987b625d7c4c97081d07db1b7d3bd8fc))
* **insights:** gear tab offers dripper, filter and grinder picks ([39e88ab](https://github.com/eric-maydeck/bean-tracker/commit/39e88abea3dd242f046235406004e3f34b6ba8ab))
* **insights:** gear trophy cards from all brews ([3f61349](https://github.com/eric-maydeck/bean-tracker/commit/3f61349319b872a2be3d03071e052812213c839c))
* **insights:** gear trophy case cards and retired shelf ([9c6a48e](https://github.com/eric-maydeck/bean-tracker/commit/9c6a48e84b0525a2b7cd041811e586175c1fbe23))
* **insights:** jump-to section chips on every tab ([fc8ebb1](https://github.com/eric-maydeck/bean-tracker/commit/fc8ebb14cfc50fe7630e772edc777e4c0026807b))
* **insights:** kind-colored gear name, icon-only chip on narrow cards ([b61a0d4](https://github.com/eric-maydeck/bean-tracker/commit/b61a0d405844423fdf8bebee139bdc9df2caa6b6))
* **insights:** name color preview, chip in the figures row, kind order, pre-skip sample ([9ecff97](https://github.com/eric-maydeck/bean-tracker/commit/9ecff9700ab55100503cbe57621d62ac2f4dd85d))
* **insights:** trophy card dialog, per-kind picks, grinder in filters, style previews ([3c88404](https://github.com/eric-maydeck/bean-tracker/commit/3c884043dd64e8cf29815c17e2d4183b5c7de4c6))
* **insights:** trophy card selection and row fill ([b7116c0](https://github.com/eric-maydeck/bean-tracker/commit/b7116c04e7c1ffc669fe2b652d3a81f4f0499ec1))
* **insights:** trophy style a only, coffee-page overlay design ([b488192](https://github.com/eric-maydeck/bean-tracker/commit/b48819275b8edfe5501c5b7f1869e08a6984f673))
* **ui:** form action rows sit 16px below their content, checked globally ([3b512f5](https://github.com/eric-maydeck/bean-tracker/commit/3b512f57c893c06b63567933df51232ab84432b4))

# [1.84.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.83.0...v1.84.0) (2026-10-22)


### Bug Fixes

* **insights:** keep the space before the dashed-gaps note ([7b3cdbd](https://github.com/eric-maydeck/bean-tracker/commit/7b3cdbd6687a66192d1ce54b433687cedfc723e9))
* **insights:** over time fills the list's card height, show all adds every group's line ([723e1b0](https://github.com/eric-maydeck/bean-tracker/commit/723e1b0d2200ccf8e68e32afca48ea692406cfa8))
* **insights:** show all and over time toggles apply in place, charts rebuild only on changed data ([4867179](https://github.com/eric-maydeck/bean-tracker/commit/48671796cc152807d7a12a91489b12b95558aeaf))
* **insights:** show all in over time keeps the card's height, only list cards start the band ([abda98d](https://github.com/eric-maydeck/bean-tracker/commit/abda98d7368445eba782a9fd379a721ffde2cfb1))


### Features

* **insights:** board jump links, view switch on small boards, ui states ([4e2c4d2](https://github.com/eric-maydeck/bean-tracker/commit/4e2c4d2b09970b55e3eac8752104989ae38daa74))
* **insights:** board views url state, over-time series, bars and over-time on small boards ([05fa7aa](https://github.com/eric-maydeck/bean-tracker/commit/05fa7aa03ff4ea7d28c93b141dc4136c2cf3d4a3))
* **insights:** boards open independently, over time never stretches, per-line dash check ([05c2741](https://github.com/eric-maydeck/bean-tracker/commit/05c274138de36340181239f66ca5d8483254ee79))
* **insights:** drop bars view, expand toggle for over time, dashed gaps across no-data periods ([b5c108b](https://github.com/eric-maydeck/bean-tracker/commit/b5c108b59e10e7797a740ab0fea74dafc3417722))
* **insights:** over time starts at the calibration date under calibrated ratings ([eb43839](https://github.com/eric-maydeck/bean-tracker/commit/eb43839cc8a1a8c79322c1cfcfd4f9ab79841bf8))

# [1.83.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.82.0...v1.83.0) (2026-10-22)


### Bug Fixes

* **insights:** bags-mode consumption note, specific dripper ui check, stale comments, backlog note ([8e0e953](https://github.com/eric-maydeck/bean-tracker/commit/8e0e9534037df4addcfa0991b068931d2dc93597))
* **insights:** dial-in records and rescued bags keep each bag's true brew order under brew filters ([816e1ab](https://github.com/eric-maydeck/bean-tracker/commit/816e1abebe4360f8611c166445ea580312e18deb))
* **insights:** every leaderboard board applies every brew filter ([64d7997](https://github.com/eric-maydeck/bean-tracker/commit/64d7997664c4515a9285ec3ace3ad6e788e1b808))
* **insights:** fractional bag counts read with one decimal in sample text ([f007eef](https://github.com/eric-maydeck/bean-tracker/commit/f007eefb0b0654da8fec8bfd0c2aab66ba94749c))
* **insights:** keep the space before the settle note's separators ([40f9dd9](https://github.com/eric-maydeck/bean-tracker/commit/40f9dd96ec7cfb292568ad3260f76d2209ec4917))
* **insights:** muted brew chip label is a no-op, keep chip padding ([bd36850](https://github.com/eric-maydeck/bean-tracker/commit/bd36850018d5684d1728989923d8c52ac6dbfe95))
* **insights:** not-quite-your-cup records use the standard tile surface ([02de012](https://github.com/eric-maydeck/bean-tracker/commit/02de0124fb4d81827828fadf9ae571c549ad5f41))
* **insights:** per-bag leaderboard line is one note, not empty boards ([03a28ef](https://github.com/eric-maydeck/bean-tracker/commit/03a28ef110b30f0746dd7f30d1862fd67339bcf8))
* **insights:** sum settle bag shares as integer brews ([0e35865](https://github.com/eric-maydeck/bean-tracker/commit/0e3586580a755e9bc68ff6718e0d1c8d5437b69f))
* **water:** default to 800 ml, lotus's own basis ([4ba67c8](https://github.com/eric-maydeck/bean-tracker/commit/4ba67c89912d1aaa8ec7f9912246a7fa86b1179a))


### Features

* **insights:** apply brew filters after dial-in, whole-bag figures stay whole ([e1c7ac0](https://github.com/eric-maydeck/bean-tracker/commit/e1c7ac0f16f29805b35f3d9e6c7317b20ad41240))
* **insights:** bold the lead-in of whole-bag notes ([b169302](https://github.com/eric-maydeck/bean-tracker/commit/b16930275cb7c79ea1d9f5ca186094757b96c800))
* **insights:** brew filter url params and per-tab offer list ([57f5ebc](https://github.com/eric-maydeck/bean-tracker/commit/57f5ebc33ce8acf045cb7eb7739f4031571dcc90))
* **insights:** brew filter values, dose bands and the brew predicate ([e4df982](https://github.com/eric-maydeck/bean-tracker/commit/e4df9821f58a1672b88cb0cfdf922610ba61de8e))
* **insights:** brew filters in the filters dialog, muted chips off-tab ([92e74f2](https://github.com/eric-maydeck/bean-tracker/commit/92e74f2ad1edf6f9a748aa158f08b7eb34a404a7))
* **insights:** brews until dialed in by dripper and by water ([f333a2b](https://github.com/eric-maydeck/bean-tracker/commit/f333a2bd469f6d872c5933edfcfe7506b8765f2c))
* **insights:** dial-in speed findings by dripper and water ([5e722f9](https://github.com/eric-maydeck/bean-tracker/commit/5e722f9f6374f78c116f743febccd828298dab6b))
* **insights:** full-height empty cards for gear boards under spend and ppg ([046257e](https://github.com/eric-maydeck/bean-tracker/commit/046257e1ce76461621fc51930c7458cfa81d8529))
* **insights:** leaderboards skip the brew filter on their own dimension ([f32ad61](https://github.com/eric-maydeck/bean-tracker/commit/f32ad61716de5cb0a98743483e52e0471993d2c0))
* **insights:** settle groups weighted by each bag's share of its window ([ec3d274](https://github.com/eric-maydeck/bean-tracker/commit/ec3d2744c60667c8adb8e81658578bd61c441ee0))
* **insights:** whole-bag notes where brew filters don't apply ([4d2153a](https://github.com/eric-maydeck/bean-tracker/commit/4d2153aa097fcac49e62de5eb5b863492f02f3fb))

# [1.82.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.81.0...v1.82.0) (2026-10-22)


### Bug Fixes

* **water:** bold the ideal-volume hint, drop idle hint gap above notes ([be73bf6](https://github.com/eric-maydeck/bean-tracker/commit/be73bf6cf744206112d3edaa51ad1252b4040acd))


### Features

* **water:** suggest each recipe's ideal volume under the picker ([0113465](https://github.com/eric-maydeck/bean-tracker/commit/0113465c789806389274cb77335274d0858f3c8f))

# [1.81.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.80.0...v1.81.0) (2026-10-21)


### Bug Fixes

* **ci:** release job publishes from the release branch, closes [#1](https://github.com/eric-maydeck/bean-tracker/issues/1) ([6d046d3](https://github.com/eric-maydeck/bean-tracker/commit/6d046d32d2c2f65faf60c89552c047c83b1256fc))
* **coffees:** filter picker title uses the panel's own font ([22e2e37](https://github.com/eric-maydeck/bean-tracker/commit/22e2e3706e5971a204dbc88a101f1159397458a0))
* **insights:** drop the column-flow rules the row-wise top lists replaced ([89c2bd9](https://github.com/eric-maydeck/bean-tracker/commit/89c2bd94f4286e7847300af2f807947c437465f3))
* **insights:** map tip closes 100ms after the mouse leaves ([39cd719](https://github.com/eric-maydeck/bean-tracker/commit/39cd71937ab0c02f131e3d105c20723db4b7d56d))
* **insights:** origin note on top, grind tiles before the last three brew extremes ([680c93b](https://github.com/eric-maydeck/bean-tracker/commit/680c93b36fe57830c36f1a3de26614b18d9f8dca))
* **insights:** overview totals tile values use the ordinary tile value color ([57cb05a](https://github.com/eric-maydeck/bean-tracker/commit/57cb05a5836b80dff09f5e3b9858e822cb5fd739))
* **insights:** paired tie gaps, proof needs a real sample, no empty tier 3 line ([b33b60b](https://github.com/eric-maydeck/bean-tracker/commit/b33b60b5e774ad05dc8df3953ff9b98e0ebf775c))
* **insights:** restore map tip close check, pin short recent list, tidy dead code ([9993f50](https://github.com/eric-maydeck/bean-tracker/commit/9993f50c985a103b54e2442a8991bbb8bca9e968))
* **insights:** roast nudge uses the t test with the bag as the unit ([2dce34a](https://github.com/eric-maydeck/bean-tracker/commit/2dce34a37fbd8abcd7811f8e26364c727645e6b7))
* **insights:** show more lands the button above Back to top, never under it ([817a413](https://github.com/eric-maydeck/bean-tracker/commit/817a4136242600814174f06e63cc53cae9fc8c7b))
* **insights:** tab controls render server-side with the bar; tab switch no longer freezes ([0faf491](https://github.com/eric-maydeck/bean-tracker/commit/0faf491b652b34b4abf1bf3dc1ab48d5c021e5db))
* **insights:** tie membership from the bar gap, proof from the paired gap ([12a0b56](https://github.com/eric-maydeck/bean-tracker/commit/12a0b561fae312a4d63d4230df06b1c109b3894a))
* **layout:** navbar width var set on the rail layout, not inside the rail rule ([e04892b](https://github.com/eric-maydeck/bean-tracker/commit/e04892b8ff234da477f8eaa02af170f5741bd52a))
* **tips:** tips stay in the visible band; test: water waits for the toggle scroll ([79fac4e](https://github.com/eric-maydeck/bean-tracker/commit/79fac4eb7e42bc1e8046d59935669202a398e394))
* **water:** drop duplicate hardness, name drop inputs by their label, refuse decimal drops ([cf0cf9b](https://github.com/eric-maydeck/bean-tracker/commit/cf0cf9bc38b2a235b6e85561046d11c059b83185))
* **water:** reset on nav, keep results while typing, share button and table a11y ([9a225f6](https://github.com/eric-maydeck/bean-tracker/commit/9a225f6dbc4bf412d747b429b448dbbef98d9695))


### Features

* **coffees:** filter editor back button, more room between counts and scrollbar ([002c298](https://github.com/eric-maydeck/bean-tracker/commit/002c29809fd1e2ace473cb00c4d5b22b97ee2918))
* **coffees:** filter picker column name is a centered bold accent title ([14c48b3](https://github.com/eric-maydeck/bean-tracker/commit/14c48b33748a377dd56d2e005095e3eb4581cebf))
* **coffees:** one list, backlog/open/archive as multi-select status toggles ([4f77ab4](https://github.com/eric-maydeck/bean-tracker/commit/4f77ab4f2b9407fcb6ddc845d430517529ff7eda))
* **insights:** clearer records wording, brew extremes home for clock records, origin map note ([46636d6](https://github.com/eric-maydeck/bean-tracker/commit/46636d6272c9714f32db3f0e4e7460d0529be409))
* **insights:** early and tie headlines for sweet spots tiles without a winner ([b26e1ce](https://github.com/eric-maydeck/bean-tracker/commit/b26e1cea09b747b0322cb4b3cfdda8056644184f))
* **insights:** headline the observed tie, badge how sure; tier 3 reads not enough data ([4867952](https://github.com/eric-maydeck/bean-tracker/commit/4867952111728dc75c5481fbe52b8a68fa4049b9))
* **insights:** hedge early leaders, thin band line, n in the running ties ([0bd3817](https://github.com/eric-maydeck/bean-tracker/commit/0bd381702001b0f3c04a2f8d9f83a68a0760eaae))
* **insights:** label sweet spots grinder as grind for, name it on the grind card ([bbf909c](https://github.com/eric-maydeck/bean-tracker/commit/bbf909cf4fc886eafd73724bfb239d3d29ec489a))
* **insights:** leaderboard links follow the rank for status ([2db1948](https://github.com/eric-maydeck/bean-tracker/commit/2db19487107024fd699c8bfbe2752ae1b7d45736))
* **insights:** like tip shows its inked gap; show more aligns the button's bottom ([48ca3e2](https://github.com/eric-maydeck/bean-tracker/commit/48ca3e252d3bdbe1d6af3b5a01b80e6bc0f3a91e))
* **insights:** map tip stays open under the mouse so its link is clickable ([8b9caec](https://github.com/eric-maydeck/bean-tracker/commit/8b9caec91a9eb17bec4d3696186e076ff6af6f5c))
* **insights:** origin map tip links to its coffees ([2c53450](https://github.com/eric-maydeck/bean-tracker/commit/2c53450e51bcdb57f0752bf5a3ae893be4df86d7))
* **insights:** per-tab controls float in the sticky filter bar ([d3e8fd3](https://github.com/eric-maydeck/bean-tracker/commit/d3e8fd3c7af83988ea9f749024ffacd1346cbc81))
* **insights:** right now tiles link to /coffees with the page-wide coffees filter ([d683d8e](https://github.com/eric-maydeck/bean-tracker/commit/d683d8ea01d695bc4e13b97e6cd204de74022d09))
* **insights:** shared arrow ends for delta bars, plain tier 3 tip, hover-safe sign ink ([b8d06e2](https://github.com/eric-maydeck/bean-tracker/commit/b8d06e2ee31b7209c42a75070a738e4770da964c))
* **insights:** show more / show less on overview recent lists ([81a2fc2](https://github.com/eric-maydeck/bean-tracker/commit/81a2fc249360739144725f01c8b1535b527146d4))
* **insights:** show more scrolls the list's bottom into view, top lists fill row by row ([d7a35e0](https://github.com/eric-maydeck/bean-tracker/commit/d7a35e0ed99e3d9581c8d2b2ab8864855082ca20))
* **insights:** sweet spots tip rows, signed ink, arrow shoulders, tier 3 tip ([79b531f](https://github.com/eric-maydeck/bean-tracker/commit/79b531f4dffbc8b4449e316f9756cec8e7ab3db8))
* **layout:** navbar aligned with content, back to top, origins filter scrollbar room ([c408b53](https://github.com/eric-maydeck/bean-tracker/commit/c408b531049e565a4994d6711397704995cf92dc))
* **water:** copy lotus's drop formula, add lume recipes ([6361f71](https://github.com/eric-maydeck/bean-tracker/commit/6361f7174e5a96702bff660dbdc2f7374fb95022))
* **water:** design c results with element colors, mg ca na k order, lotus credit ([ca2cec0](https://github.com/eric-maydeck/bean-tracker/commit/ca2cec0924c761b723a06eb4e58ad287c2321110))
* **water:** kettle in the url, alphabetical recipes, all four concentrates shown ([c298acf](https://github.com/eric-maydeck/bean-tracker/commit/c298acf675e6aca7e2ea0662c263ca39006ac547))
* **water:** lotus drop calculator page with kettle picker and slider ([726984a](https://github.com/eric-maydeck/bean-tracker/commit/726984a70a56d82773f2da144844dbc659b5aec2))
* **water:** recipe, drops and target tabs, minerals in mg/L, slider scale ([ea6f4d9](https://github.com/eric-maydeck/bean-tracker/commit/ea6f4d9a282986a51d5cf3a8d0dd72bc1b80bf2e))
* **water:** remember the page state per browser, two columns in phone landscape ([b83ff9d](https://github.com/eric-maydeck/bean-tracker/commit/b83ff9de921c004655dc89ed1daea7d1104bee6f))
* **water:** reset button, and write the restored state to the url after a full load ([08c39cf](https://github.com/eric-maydeck/bean-tracker/commit/08c39cf234db0cf72dd3d9a58ba509daa43deea4))
* **water:** two columns on wide screens, narrow column on phones ([c763c26](https://github.com/eric-maydeck/bean-tracker/commit/c763c268b91cf5da379cc25b14a4f106745f3779))

# [1.80.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.79.1...v1.80.0) (2026-10-19)


### Bug Fixes

* **insights:** a text tip inside a clamped card opens only its own tip ([0bfc06b](https://github.com/eric-maydeck/bean-tracker/commit/0bfc06bcb1890075be0ea28a6e91eeae23130d96))
* **insights:** versus values sit on the row's value line ([c06138b](https://github.com/eric-maydeck/bean-tracker/commit/c06138b60d52816d3b7017113d8b4d2fd7ea71ee))
* **subscriptions:** pending chip centered under the buttons, total on its line ([2e4b520](https://github.com/eric-maydeck/bean-tracker/commit/2e4b520e7daff92b9d15736e4d665b2b92c2f1a7))
* **subscriptions:** the bag total lines up with the g/bag input's text ([861a003](https://github.com/eric-maydeck/bean-tracker/commit/861a0032c84d191eed1b527c486301baf2dafade))


### Features

* chart tips show their units ([a9ad037](https://github.com/eric-maydeck/bean-tracker/commit/a9ad037210adb05d4ca2282b1c97f00a890f3897))
* **coffees:** roast icons open the level as a text tip; label tip states ([feb82c0](https://github.com/eric-maydeck/bean-tracker/commit/feb82c04acc227271703b84d42e2954b1eae2e2c))
* **insights:** findings headlines clamp to 2 lines with a tip; the ruler is grab, closes [#anchor](https://github.com/eric-maydeck/bean-tracker/issues/anchor) ([7817c33](https://github.com/eric-maydeck/bean-tracker/commit/7817c33303727fac0d8fdc4e882a6d5a2e04f14c))
* **insights:** labeled-point headline tips everywhere; larger versus values with their sample ([a027f00](https://github.com/eric-maydeck/bean-tracker/commit/a027f00264df42df8d98831e9cb4a155446a3364))
* **insights:** no card-level popover on Sweet spots cards ([e23a83c](https://github.com/eric-maydeck/bean-tracker/commit/e23a83c0bbfc2bf6a47312585b00876b903fb4e1))
* **insights:** one headline tip for findings; leaner gear switch and versus cards ([1533a54](https://github.com/eric-maydeck/bean-tracker/commit/1533a540dcaf3779676c5ac738973dec6c892642))
* **insights:** shorter findings headlines, the like-group in a tip ([65eb9d1](https://github.com/eric-maydeck/bean-tracker/commit/65eb9d1e547cd93aaec75dc60b5d9fd1233f17e2))
* **insights:** world map tip is the shared FloatTip data tip ([288d90c](https://github.com/eric-maydeck/bean-tracker/commit/288d90c81bc6f971af9d18793e7c5afac6302f00))
* label tips for icon-only buttons and filter chips ([684ab70](https://github.com/eric-maydeck/bean-tracker/commit/684ab70c3beabb4140681f46eb6c834512138c9e))
* map taps pin the tip, tap tips stay open, tip-only clicks show help ([3f70e34](https://github.com/eric-maydeck/bean-tracker/commit/3f70e34ea5741c2f70e709ba692b9336f0e8e410))
* **stats:** exact-weight tips and the per person help popover ([69ceebd](https://github.com/eric-maydeck/bean-tracker/commit/69ceebd2ff7735d096e1ebd2315b341d39de7079))
* **subscriptions:** pending chip with a tip, visible bag total in the edit table ([23d415f](https://github.com/eric-maydeck/bean-tracker/commit/23d415f0ec00a87c4f81f923d69276d89dcf4b6a))
* the last native title tips become the shared hover tip ([d8c686a](https://github.com/eric-maydeck/bean-tracker/commit/d8c686a611038a6249bc8da4522ad7221eccf28b))
* tips open only on their marks; cursors follow the user's ruling ([c712c2c](https://github.com/eric-maydeck/bean-tracker/commit/c712c2c05073d0c964e1dd7bae63b7bbaa3ecabb))

## [1.79.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.79.0...v1.79.1) (2026-10-18)


### Bug Fixes

* **data:** shoebox rest windows to 45 days (caf) and 30-60 (decaf) ([e4864f9](https://github.com/eric-maydeck/bean-tracker/commit/e4864f9bcc397c3e8b39affd95cfb99e4177f362))

# [1.79.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.78.0...v1.79.0) (2026-10-18)


### Features

* show coffee names containing skip in purple everywhere ([af495e2](https://github.com/eric-maydeck/bean-tracker/commit/af495e2d04865fe7d422c12e572d9d68cb8f9575))
* **theme:** add skip color token; decaf badge turns rose ([ba648f2](https://github.com/eric-maydeck/bean-tracker/commit/ba648f24c5b80d756e1ae5100e36874a0e3ef3aa))

# [1.78.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.77.0...v1.78.0) (2026-10-18)


### Bug Fixes

* **charts:** a chart tip another tip dismisses unmounts instead of staying hidden ([6988222](https://github.com/eric-maydeck/bean-tracker/commit/6988222afbe56b238b686a08ba8d0966891133d6))
* **coffees:** like panel matches Leaderboards on decaf, no blank grid track, shared signed ([84163c6](https://github.com/eric-maydeck/bean-tracker/commit/84163c6413a02c699880c7aedfc31360b1205679))
* **coffees:** the no-comparison tip counts dial-in brews only among calibrated ones ([aa83943](https://github.com/eric-maydeck/bean-tracker/commit/aa8394371c67a65cca9895f4eea9c8d4b0a8d10a))
* every price, spend and cost shows dollars to 2 decimals through one formatter ([6a0a539](https://github.com/eric-maydeck/bean-tracker/commit/6a0a5393b504ed8f4ac624b28500b6ee097eee4e))
* **insights:** a board value is tipped only when the tip adds to the row ([1654be8](https://github.com/eric-maydeck/bean-tracker/commit/1654be877cdac450f6b8a1ac32ab63416a0d1089))
* **insights:** a left-pointing small bar's corner fold sits top right ([434bd9e](https://github.com/eric-maydeck/bean-tracker/commit/434bd9e50af54ecd420f1a2d801a2f44aadf561c))
* **insights:** a like line is a tab stop and opens on Enter only when cut ([915937b](https://github.com/eric-maydeck/bean-tracker/commit/915937b24eb343b620d68f74dd12995358384c32))
* **insights:** a repurchase stays out of its twin's like group ([2b8b107](https://github.com/eric-maydeck/bean-tracker/commit/2b8b107866bc956bd065764b1098e6eb36db9a27))
* **insights:** badges explain the gap against its margin of error ([4e4af71](https://github.com/eric-maydeck/bean-tracker/commit/4e4af71d5799062ba6f93225e0de8cdfb37bcf9a))
* **insights:** bag means and gaps between them show one decimal ([d9a15f8](https://github.com/eric-maydeck/bean-tracker/commit/d9a15f8fddc6b42f85d4e7aa0d2a449f849a92bd))
* **insights:** bag-mean findings use the page's 4-brew bag rule ([a956d97](https://github.com/eric-maydeck/bean-tracker/commit/a956d977e8f99d242995137ac3a3d1b2c6bcbdae))
* **insights:** brews until dialed reads each bag's first 7 brews, closes [1-#7](https://github.com/1-/issues/7) ([098cdb1](https://github.com/eric-maydeck/bean-tracker/commit/098cdb1c2a73bb4c684da26cd1d390f64865f7d0))
* **insights:** dial-in by group always lists; with no measurable z it has no bar ([b480a8c](https://github.com/eric-maydeck/bean-tracker/commit/b480a8c69548bf311ae7cee7d4534aafa9c2bb00))
* **insights:** dial-in by group progress is (z / bar)²; no card when z can't be measured ([ba18d3d](https://github.com/eric-maydeck/bean-tracker/commit/ba18d3d3773e670a40908b8d8714e9c699b512d4))
* **insights:** empty leaderboard panels fit their note ([997c9c5](https://github.com/eric-maydeck/bean-tracker/commit/997c9c59102399254d8ec97a989d18152b1eaf27))
* **insights:** empty panels are one short line ([eadb413](https://github.com/eric-maydeck/bean-tracker/commit/eadb413e9fb80f5d9f278a8c3631eb47a2fac2c1))
* **insights:** equal row gaps in the phone control bar ([a76799b](https://github.com/eric-maydeck/bean-tracker/commit/a76799ba4a220eb23523c4fb0a3b6a4fc12b3bc8))
* **insights:** every bag counts in pooled means, weighted by its brews ([f94b5f9](https://github.com/eric-maydeck/bean-tracker/commit/f94b5f980c92e83e0ff2ce76968ef6d2d636af10))
* **insights:** every too early card has its progress bar, dial-in by group too ([c5fdfed](https://github.com/eric-maydeck/bean-tracker/commit/c5fdfed81e903c483a3c0f1deb1c019f6723be19))
* **insights:** filters field sits level with the bar's controls ([d290a39](https://github.com/eric-maydeck/bean-tracker/commit/d290a393077d41144f5c5900127a6828bbd27343))
* **insights:** final-review minors ([661c6e0](https://github.com/eric-maydeck/bean-tracker/commit/661c6e09d2da9c3a85d2b08e99f3c66fc86fa90e))
* **insights:** finding deltas show 2 decimals only when their margin is under 0.05 ([8a7da6d](https://github.com/eric-maydeck/bean-tracker/commit/8a7da6d1a719b54445d719e1a1b1831dfef54cd9))
* **insights:** finding links keep the page's Period, ratings, caffeine and Coffees filter ([384d589](https://github.com/eric-maydeck/bean-tracker/commit/384d589e4c54acb31c2b21069d31f24538cbf2b2))
* **insights:** findings use the t test at every n, with no step at 30 ([49d28c2](https://github.com/eric-maydeck/bean-tracker/commit/49d28c284bc4899014249e942557160db1dd4950))
* **insights:** group 10-brew rule counts dial-in brews; tips follow the mode ([8479986](https://github.com/eric-maydeck/bean-tracker/commit/8479986372f0674dcb38170a72a3ec898175d66c))
* **insights:** group findings compare a group with the rest, not a pool holding it ([89d10b5](https://github.com/eric-maydeck/bean-tracker/commit/89d10b52ab6329b81976b7413568f0753c700708))
* **insights:** habits rating charts say they are raw means ([aa390fb](https://github.com/eric-maydeck/bean-tracker/commit/aa390fbf61729395298dd1398a9f92f35c7619bf))
* **insights:** lab badges never back a gap the bar contradicts, and tier 2 counts bags once ([1d9f12d](https://github.com/eric-maydeck/bean-tracker/commit/1d9f12d94be5075889dc0e7d0ddc1b268731dc77))
* **insights:** lab badges use the page's t test with the bag as the unit ([d90e781](https://github.com/eric-maydeck/bean-tracker/commit/d90e781d681854831b7c25ad858ce755279105ec))
* **insights:** lab charts pick their decimals per chart, not per row ([f6a9d8a](https://github.com/eric-maydeck/bean-tracker/commit/f6a9d8a6522ee3986c10282f7b8d0d340008c7e5))
* **insights:** lab deltas and means show 1 decimal unless the bag-level se is under 0.05 ([b3a3b59](https://github.com/eric-maydeck/bean-tracker/commit/b3a3b59f4145849d11d5d9b4ac742a9f9bfccd42))
* **insights:** leaning and its setting read as one phrase in one size ([26e61db](https://github.com/eric-maydeck/bean-tracker/commit/26e61db78daad7d9cdb5a60bdc458b52c79cf549))
* **insights:** like line tip uses the shared float tip, opens on hover, tap and focus ([60a2e8f](https://github.com/eric-maydeck/bean-tracker/commit/60a2e8f810813352b4bb415900237d75ab9d135c))
* **insights:** like rank help, See-all rows, and only boards that can rank ([698a666](https://github.com/eric-maydeck/bean-tracker/commit/698a6664324db047a637e58aa67f27276124ccd4))
* **insights:** likeRoaster small-sample rule, twin tags, phone bar labels, tighter milestones check ([3c7b46c](https://github.com/eric-maydeck/bean-tracker/commit/3c7b46cb9f94a69f261f37febe915e2e0317ecc5))
* **insights:** money mini charts read their values as usd for screen readers ([201840f](https://github.com/eric-maydeck/bean-tracker/commit/201840fb769ca9b0184c4e5b64d7661b2a9de749))
* **insights:** more dollar amounts get the Usd tip; ± note says what an SE is ([b637744](https://github.com/eric-maydeck/bean-tracker/commit/b637744c35311c1511d5d58c971097f4ccf89463))
* **insights:** myths show their margin of error and claim no effect only inside it ([408d5e4](https://github.com/eric-maydeck/bean-tracker/commit/408d5e4626c41c67689b184ac9a565c342c20074))
* **insights:** name the confident cutoff on boards it emptied ([9630b36](https://github.com/eric-maydeck/bean-tracker/commit/9630b367e4a5fcc45cd75b95175d4bce17881f05))
* **insights:** no clear winner cards name the best-so-far setting ([5ded642](https://github.com/eric-maydeck/bean-tracker/commit/5ded6425e2e055eeceaeb47692523519ee41d55e))
* **insights:** no clear winner sweet spots lines take the accent ink; contrast notes corrected ([d3b284f](https://github.com/eric-maydeck/bean-tracker/commit/d3b284ff628ac932a29d963f40ee9730d7cf8edb))
* **insights:** notes finding says the cause likely runs the other way ([d0a1109](https://github.com/eric-maydeck/bean-tracker/commit/d0a11094deaedbf607b96f5af3a58a0278a2e3a9))
* **insights:** once dialed skips dial-in brews by position only ([ab47106](https://github.com/eric-maydeck/bean-tracker/commit/ab4710698bd80c78f81ada075926c3d2c738ae60))
* **insights:** once dialed skips the first brew of a 4–7 bag, two of an 8+ bag, closes [#2](https://github.com/eric-maydeck/bean-tracker/issues/2) [#3](https://github.com/eric-maydeck/bean-tracker/issues/3) ([8d239c7](https://github.com/eric-maydeck/bean-tracker/commit/8d239c7ecde93907f70dc4a54fd2701e73f49f2b))
* **insights:** one empty panel when a filtered tab has nothing ([f537d2a](https://github.com/eric-maydeck/bean-tracker/commit/f537d2a8a56e5ee8eb0c6793dc53665680add994))
* **insights:** only rows with a like line grow; ink check, tidy lookups ([e7fc108](https://github.com/eric-maydeck/bean-tracker/commit/e7fc10872f7afe5fc0ef741838ccc5601ed4497f))
* **insights:** overview tiles fit 2-decimal costs ([22f381c](https://github.com/eric-maydeck/bean-tracker/commit/22f381cc720fe22d59fdf92c86b50fff1efd0d53))
* **insights:** pooled means count only bags with 4+ rated brews ([24354f5](https://github.com/eric-maydeck/bean-tracker/commit/24354f5e9f0046e6582c653db65f9c9c3fa3e7b2))
* **insights:** rank like leaves out low-confidence rows ([1e3d17a](https://github.com/eric-maydeck/bean-tracker/commit/1e3d17a2320fc9ccd8319484431609f62f0a619b))
* **insights:** readable reason list when one reason holds an or ([faf1d83](https://github.com/eric-maydeck/bean-tracker/commit/faf1d83fa9280f2958846147949438f81c8c89b8))
* **insights:** rescued bags compare the first two brews with the rest ([30816ab](https://github.com/eric-maydeck/bean-tracker/commit/30816aba797c7b18b372ea8f014aa1a4d594331f))
* **insights:** rescued bags say how many chance alone would rescue ([7cda465](https://github.com/eric-maydeck/bean-tracker/commit/7cda4656dcebe00ac68f8839e900c24d6ee2eca1))
* **insights:** roast nudge on a z of 2 and a gap of half a point ([0df5f38](https://github.com/eric-maydeck/bean-tracker/commit/0df5f38426b2df4875f10e9007412cda766a29c1))
* **insights:** roaster like gaps vs other roasters, rescue and dial-in rules, bar labels, seed ([541b76f](https://github.com/eric-maydeck/bean-tracker/commit/541b76fe298242608bf0e98a6cf7e0b2f92fc962))
* **insights:** rows show their scored brews; chip and tips give both counts ([edad162](https://github.com/eric-maydeck/bean-tracker/commit/edad162f0e1a776961a8426a967a441a357cc842))
* **insights:** see all counts every bag under raw and the peak scores ([e0973da](https://github.com/eric-maydeck/bean-tracker/commit/e0973dab197a752fe49eb465c8cfb68eb4f3ed52))
* **insights:** see all under rank like counts every bag in the roaster figure ([e9d2114](https://github.com/eric-maydeck/bean-tracker/commit/e9d2114ac99478b21c358493d0dd7970cbd7a579))
* **insights:** see-all note blames each setting that hid rows; review minors ([b4b5b03](https://github.com/eric-maydeck/bean-tracker/commit/b4b5b03b0416db2e8dcdb7b82ded4be86da8378f))
* **insights:** setting names are bold brown in tips and chart notes too; dial window from data ([ae50979](https://github.com/eric-maydeck/bean-tracker/commit/ae50979f69d88966ccbf49e36c24dd540e6729bf))
* **insights:** setting names in prose are bold brown; their default notes are green ([58646d1](https://github.com/eric-maydeck/bean-tracker/commit/58646d1e89be1b2c28fe174d45c85105dd225342))
* **insights:** settle bars get a tip with counts, small-sample caveat last ([181c02f](https://github.com/eric-maydeck/bean-tracker/commit/181c02fb19487cac003e62c41c24f26ee466f723))
* **insights:** settle brews measured within each bag's first 6 brews ([737afef](https://github.com/eric-maydeck/bean-tracker/commit/737afef63faa6fab97ea2cafeafe3a8b15d8c06e))
* **insights:** show-all footer only where a band row needs it ([e09d587](https://github.com/eric-maydeck/bean-tracker/commit/e09d58766e8dbdefb884b4989d9de27a65deffed))
* **insights:** small-sample findings use a t test ([66fc551](https://github.com/eric-maydeck/bean-tracker/commit/66fc551ebb757103aed20808249a749914ab50fd))
* **insights:** sweet spots best so far reads as the answer alone, its numbers in a tip ([a669b29](https://github.com/eric-maydeck/bean-tracker/commit/a669b2983b1248773a7188f8aed181db8edf9176))
* **insights:** sweet spots lines are short with numbers in a tip; results in the accent ink ([96db159](https://github.com/eric-maydeck/bean-tracker/commit/96db1596b5d069373abc5d5f551f313af07429fe))
* **insights:** tapping a cut-off like line follows the row link ([0cb9725](https://github.com/eric-maydeck/bean-tracker/commit/0cb9725373a5899ee1a59f29d26ffaf6c17c70f4))
* **insights:** the cutoff line names a board only when full bags would fill it ([a3d07c4](https://github.com/eric-maydeck/bean-tracker/commit/a3d07c4fa25abe44c6e1d4f60303efec40a85d37))
* **insights:** the dial-in story quotes ratings within a bag, closes [#1](https://github.com/eric-maydeck/bean-tracker/issues/1) ([7b26521](https://github.com/eric-maydeck/bean-tracker/commit/7b2652125cb1598991acb585b1d3da8acdb8a71e))
* **insights:** the hidden-by-settings tip lists one row per board and the reasons once ([41eda19](https://github.com/eric-maydeck/bean-tracker/commit/41eda191af00f32affda199a0f3147a8f8d1cca2))
* **insights:** the hidden-by-settings tip type is plain TypeScript, so tsc stays at baseline ([a3106a9](https://github.com/eric-maydeck/bean-tracker/commit/a3106a9486144d708b6d54fefc6c034ce83fc94d))
* **insights:** the many-findings line counts every test run, under any theme ([d7fada4](https://github.com/eric-maydeck/bean-tracker/commit/d7fada47c8f5fc7c1850d8e161a00178da013b24))
* **insights:** the score help's default entry gets its own group header ([a429f84](https://github.com/eric-maydeck/bean-tracker/commit/a429f84bee93678c14db17d4b91b06df06e4017e))
* **insights:** the settle tip counts the brews it read, and its small-group shape is unit-tested ([79f0db7](https://github.com/eric-maydeck/bean-tracker/commit/79f0db73c3527ee0dc5d8a8c01c0deddb5477b04))
* **insights:** too early lists 6 leads past 1× their margin of error ([62ef506](https://github.com/eric-maydeck/bean-tracker/commit/62ef5066aa7d382024dea25961180df789c36385))
* **milestones:** resize the side ruler when the bar or viewport height changes ([30117cc](https://github.com/eric-maydeck/bean-tracker/commit/30117cc77bc2d05fd96f5e0d33fa94796e65789d))
* **money:** $1,000 and up shows whole dollars; the tip keeps the cents ([ae69f5f](https://github.com/eric-maydeck/bean-tracker/commit/ae69f5f62e5849608be174b82234e04c9ac5c968))
* **money:** charts and lists keep one format; stats cost chart labels use usd ([b63256b](https://github.com/eric-maydeck/bean-tracker/commit/b63256bb31e2e5b0f39e2b2f30c28ce343bc13ce))
* **stats:** by method and by grinder say how many of their groups they show ([24a36f7](https://github.com/eric-maydeck/bean-tracker/commit/24a36f7dda0a5f6eccdf7f69cad6f62c7b33db95))
* **stats:** showing top n of m only shows when the chart cuts something ([c72f6cd](https://github.com/eric-maydeck/bean-tracker/commit/c72f6cd827e8e53042d9f021264e3de9a122b0cb))
* **ui:** a revealed tip never scrolls its own anchor under the sticky bar ([7dd128c](https://github.com/eric-maydeck/bean-tracker/commit/7dd128c138cd930ba9bde5053b579ae1d6e45a72))
* **ui:** a text tip is inline text, so a wrapped label opens only from its words ([fefc0d9](https://github.com/eric-maydeck/bean-tracker/commit/fefc0d9aedf2e19dbc5967d4cf910164efe4fe3b))


### Features

* **coffees:** explain a missing vs like coffees panel, honor ratings and dial params ([19c63e6](https://github.com/eric-maydeck/bean-tracker/commit/19c63e63e22f052e34e6e5f8c1a195c0a89a635e))
* **coffees:** vs like coffees panel on the coffee page ([427cccc](https://github.com/eric-maydeck/bean-tracker/commit/427cccc928f1187a94e3bb1731a310625c23a7e7))
* **insights:** a cut like line opens its full text on tap or enter ([02707c5](https://github.com/eric-maydeck/bean-tracker/commit/02707c53e222d79c86d9caa0db33566d30734607))
* **insights:** an odd Too early list pulls in the next lead the cap cut ([3fe093d](https://github.com/eric-maydeck/bean-tracker/commit/3fe093d41156fb2d8dabb7e6ef4e1de552a41168))
* **insights:** board-count tooltip and accurate See all reasons ([f4f5011](https://github.com/eric-maydeck/bean-tracker/commit/f4f501119ba1a888c375d1ad708dd20eb543539a))
* **insights:** brews until dialed in by roast level and process on brewing ([c62490a](https://github.com/eric-maydeck/bean-tracker/commit/c62490a80792433959cff33e84b26f541952fb08))
* **insights:** brews until dialed says it shows the first 7 brews; see all tips the rest ([9d6b02b](https://github.com/eric-maydeck/bean-tracker/commit/9d6b02bdde167163b5b40fb984594d2635e318eb))
* **insights:** coffees button, panel and chips for the page-wide filter ([003f8bf](https://github.com/eric-maydeck/bean-tracker/commit/003f8bf035a812b08d2aa43e665b4a183b7f5e13))
* **insights:** coffees default to a by-brews confidence score; min3 is "Average (3+ bags)" ([463e0d5](https://github.com/eric-maydeck/bean-tracker/commit/463e0d5e03f214bae50269ad5db8fb6987879d9d))
* **insights:** dialinBy findings always show, too early ones outside the cap ([495b003](https://github.com/eric-maydeck/bean-tracker/commit/495b0033655b25458bf3487054996ee9494c04c8))
* **insights:** findings for like-coffee standouts, dial-in by group, rescues ([bf82be0](https://github.com/eric-maydeck/bean-tracker/commit/bf82be08c6067dfc232b25424560e3ddd3069d0a))
* **insights:** group rows show their score ± 1 SE; boards within noise say so ([709c8d1](https://github.com/eric-maydeck/bean-tracker/commit/709c8d1ab4a35a6b913d7c2c5c477dce102bc5a1))
* **insights:** like line under every leaderboard rank but like ([f2f458e](https://github.com/eric-maydeck/bean-tracker/commit/f2f458ea3985a98c11958eeec1be14aa18a42f91))
* **insights:** like-coffee groups with self-exclusion ([c5e2d16](https://github.com/eric-maydeck/bean-tracker/commit/c5e2d165e692fc78f5e2756c435e0ea0f49eef2e))
* **insights:** nudge to filter by roast when roast levels rate apart ([5a1934b](https://github.com/eric-maydeck/bean-tracker/commit/5a1934b78d608ca39db335048a04d442e21ff3b4))
* **insights:** page-wide coffees filter in the load ([50f1d35](https://github.com/eric-maydeck/bean-tracker/commit/50f1d35e6fd270877b3025ca0975ca650f89bf54))
* **insights:** phone-short Period/Compare words before first paint, ellipsis on long selects ([56c5dbd](https://github.com/eric-maydeck/bean-tracker/commit/56c5dbdcef27e3a1ef48baa8dea9067cc5f8b889))
* **insights:** rank coffees and roasters vs like coffees ([162464b](https://github.com/eric-maydeck/bean-tracker/commit/162464bb7916e80dc805488e439aa448921810b0))
* **insights:** remember the view for 12 hours; reset clears it ([f7a0344](https://github.com/eric-maydeck/bean-tracker/commit/f7a0344c8c41b240ca0cdba8d50543a176d09e16))
* **insights:** say how many Likely badges a page of findings earns by chance ([bd15e9f](https://github.com/eric-maydeck/bean-tracker/commit/bd15e9ff1f86cf68ee44e20c98be589c26ea233d))
* **insights:** see all note as one short line, its breakdown in a tip ([27c36ba](https://github.com/eric-maydeck/bean-tracker/commit/27c36ba4eafaec08ed420e95aa86d277ce345de9))
* **insights:** see all when settings hide results ([ea01e92](https://github.com/eric-maydeck/bean-tracker/commit/ea01e92796bf2a8ce0d75a32a145b429f5ce013d))
* **insights:** see-all note gives each board its own reasons ([75d6c32](https://github.com/eric-maydeck/bean-tracker/commit/75d6c32c247728d4c25c86028767714b2d80220b))
* **insights:** the default Period is All time, on /insights and /stats ([645b5bb](https://github.com/eric-maydeck/bean-tracker/commit/645b5bbbb50946e0e57297b6574357a00a641cfb))
* **insights:** vs like coffees line on coffee rows ([d329807](https://github.com/eric-maydeck/bean-tracker/commit/d3298074c6be074ab5f67d919c95580639f1b188))
* **insights:** zero-centred delta bars under rank like ([a6e4e9a](https://github.com/eric-maydeck/bean-tracker/commit/a6e4e9a4324fd0e2daaf018e3274f997685559c9))
* **money:** a rounded dollar amount shows its 4-decimal value in a tip ([be0be4f](https://github.com/eric-maydeck/bean-tracker/commit/be0be4ff08907822c72b5e2bb0e2cfea922fc7a9))


### Performance Improvements

* **insights:** skip like lines where boards are only counted, pre-split like groups by roast ([aea20f8](https://github.com/eric-maydeck/bean-tracker/commit/aea20f82695759941e5b3b197de33ac7d0cac1f7))

# [1.77.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.76.2...v1.77.0) (2026-10-16)


### Bug Fixes

* **coffees:** list table words no longer break mid-word ([074c169](https://github.com/eric-maydeck/bean-tracker/commit/074c169a511475bdda8bf344aca2eca7d32023b5))
* **insights:** a dismissed tip tells its owner ([eb1b918](https://github.com/eric-maydeck/bean-tracker/commit/eb1b918079afeca43d63ddb8de35ec4385ed14b4))
* **insights:** hover ink reaches the sub line note, mineral map uses the muted look ([ed1dcce](https://github.com/eric-maydeck/bean-tracker/commit/ed1dcce68006976a88f2397136ce0ce649638997))
* **insights:** label the overview brews switches ([cd875f5](https://github.com/eric-maydeck/bean-tracker/commit/cd875f5ea0b202dc6741103a773711af309e4b2e))
* **insights:** old score links no longer read object prototype names ([f103711](https://github.com/eric-maydeck/bean-tracker/commit/f103711a6424f175288ef268e345aace7cee8b2e))
* **insights:** view menu button reports aria-expanded ([d34dfb8](https://github.com/eric-maydeck/bean-tracker/commit/d34dfb8b01e485babc9b865f0074888e14683ec3))
* **insights:** view menu label fits narrow phone columns ([a809c4f](https://github.com/eric-maydeck/bean-tracker/commit/a809c4f33aad7d848e90acfd1c38bdc8997b9a1c))


### Features

* **insights:** brews switch beside every ratings switch ([f9383dd](https://github.com/eric-maydeck/bean-tracker/commit/f9383ddfdb57ead5af8d68695c55c82ddff4798c))
* **insights:** default Score is the raw average, confident ([c082ee6](https://github.com/eric-maydeck/bean-tracker/commit/c082ee629d4eb72153f121cf368f73008a14cbb3))
* **insights:** once dialed by default, dial=all keeps every brew ([c4930c8](https://github.com/eric-maydeck/bean-tracker/commit/c4930c85b30054498ac120c8907c533267572a19))
* **insights:** once-dialed tiers and the settle helper in dialed.ts ([bf53f14](https://github.com/eric-maydeck/bean-tracker/commit/bf53f14e809ab955f7695ef295baa94198395919))
* **insights:** one small-sample look on charts, heatmaps and legends ([6a214d5](https://github.com/eric-maydeck/bean-tracker/commit/6a214d56f40fa34453b5aa79ed2adf0eb5212be9))
* **insights:** one small-sample marker on board rows ([138e477](https://github.com/eric-maydeck/bean-tracker/commit/138e477a8bedece34a8f66d90252ee137424a027))
* **insights:** one small-sample rule ([48a441d](https://github.com/eric-maydeck/bean-tracker/commit/48a441db9c0c49579e0cf46372539baf78071408))
* **insights:** ratings and brews become one sticky-bar menu, toggles keep the scroll ([ffb4a38](https://github.com/eric-maydeck/bean-tracker/commit/ffb4a38e97c779a03e39112ad24fb9f2792715be))
* **insights:** ratings and brews switches live in the sticky bar ([cff080c](https://github.com/eric-maydeck/bean-tracker/commit/cff080c5675512132b3d36c7d6ec15f4dd68c625))
* **insights:** records brews switch in the sticky bar, dial scores read all brews ([8da5247](https://github.com/eric-maydeck/bean-tracker/commit/8da524733c3168528f18a5ea58d86e1ca974f802))
* **insights:** retire the best-half scores, default Score is the raw average ([dcc853b](https://github.com/eric-maydeck/bean-tracker/commit/dcc853b98bad25f846192fea78e689233a5a97dc))

## [1.76.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.76.1...v1.76.2) (2026-10-15)


### Bug Fixes

* **insights:** rated tile caption sits in place at 360/390 in firefox ([89d5de2](https://github.com/eric-maydeck/bean-tracker/commit/89d5de2c731b8e3d8cac48799148a9b4cb2be17a))

## [1.76.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.76.0...v1.76.1) (2026-10-15)


### Bug Fixes

* **insights:** milestones ruler spans the first header to the panel's bottom ([48dd69c](https://github.com/eric-maydeck/bean-tracker/commit/48dd69ce195756a8328ec6a4eefc479df75fc009))

# [1.76.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.75.0...v1.76.0) (2026-10-15)


### Bug Fixes

* **insights:** tile rows never orphan a tile at fractional widths ([1be5c8c](https://github.com/eric-maydeck/bean-tracker/commit/1be5c8cb11265f93398cb6dc9e8801865141d6dc))


### Features

* **insights:** milestones ruler keeps its height and slides off with the feed ([0140cd0](https://github.com/eric-maydeck/bean-tracker/commit/0140cd07558ffcb3bc4e4d025ca6d20978edabfe))
* **insights:** side rail of every view on wide screens ([2bff3c2](https://github.com/eric-maydeck/bean-tracker/commit/2bff3c2af81ef5c1386bd767b0cb490aa6d257ce))

# [1.75.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.74.2...v1.75.0) (2026-10-15)


### Bug Fixes

* **coffees:** clone from a coffee page shows the added popup ([bf44c17](https://github.com/eric-maydeck/bean-tracker/commit/bf44c17594b4724a3b1b24ea01902fa1895df179))
* **insights:** days open start at the earlier of opened and first brew ([0a5b0d7](https://github.com/eric-maydeck/bean-tracker/commit/0a5b0d7e00b5c4bdd9577fabbbc33dbbeb4f8388))


### Features

* **insights:** bar hover and a recent panel on overview (preview variants) ([ddedf63](https://github.com/eric-maydeck/bean-tracker/commit/ddedf63c6c02f7880011326e4e57bc5ef4c0d08a))
* **insights:** readable bar hover and value column labels on recent ([da62813](https://github.com/eric-maydeck/bean-tracker/commit/da62813e37cfafd4da062a543b5e1d41f910b9ed))
* **insights:** recent brews and finished coffees data for overview ([f5ceb20](https://github.com/eric-maydeck/bean-tracker/commit/f5ceb20e59cb46bb93b0dd9aafdef770788c9438))

## [1.74.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.74.1...v1.74.2) (2026-10-14)


### Bug Fixes

* **coffees:** record open/freeze/thaw on the local date, not utc ([f698560](https://github.com/eric-maydeck/bean-tracker/commit/f698560fb8078c065245dcce726d475869c2ccb3))
* **coffees:** show opened/archived dates on the local calendar, not utc's ([56f703d](https://github.com/eric-maydeck/bean-tracker/commit/56f703d01f71944d37d70477781781fd606727c5))
* **data:** boot-correct coffee 6's thaw date the utc bug wrote a day late ([24f0aea](https://github.com/eric-maydeck/bean-tracker/commit/24f0aeac8f53add071782b62ffe9034162933f3c))
* **test:** seed brew times on the local clock, not utc ([cd2b02c](https://github.com/eric-maydeck/bean-tracker/commit/cd2b02c10bf95d129a351492d6d9e5edd05b34c7))

## [1.74.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.74.0...v1.74.1) (2026-10-14)


### Bug Fixes

* **db:** wait up to 5s on a locked database instead of failing ([314dcd1](https://github.com/eric-maydeck/bean-tracker/commit/314dcd1ccdb7a746c9a50e7b2642103ca1c7c81f))
* **test:** reject prototype keys as ui profiles ([797ed37](https://github.com/eric-maydeck/bean-tracker/commit/797ed374af57b31637a78e5f94e814cea589d8ed))
* **ui:** drop command from metrics run.json to keep it valid json ([812bfc6](https://github.com/eric-maydeck/bean-tracker/commit/812bfc6eb187b108dea26a403375b510ffde6ea5))

# [1.74.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.73.0...v1.74.0) (2026-10-13)


### Bug Fixes

* **charts:** canvas chart tips render the shared tip format ([476f57c](https://github.com/eric-maydeck/bean-tracker/commit/476f57c2f2c83de3b26a4d3b709454b23edbf8f6))
* **insights:** a water pair never shows both recipes in one color ([3830ef6](https://github.com/eric-maydeck/bean-tracker/commit/3830ef6f6d56db61358c89dfbd0728d4711e2050))
* **insights:** a water profile with no minerals entered stays out of mineral charts ([252866c](https://github.com/eric-maydeck/bean-tracker/commit/252866c12014be7724cb295566780ac1aaf26e19))
* **insights:** brewing chart pairs fill their height; rest axis starts at the data ([056434e](https://github.com/eric-maydeck/bean-tracker/commit/056434e380163c42e85fda2336c55c078d53acac))
* **insights:** dark mineral map cells keep 4.5:1 text contrast ([1118dd6](https://github.com/eric-maydeck/bean-tracker/commit/1118dd6f9dd86d949dd98d6e1c002fda11ab9b30))
* **insights:** delta colors get a visible tint floor, thin data striped ([761e389](https://github.com/eric-maydeck/bean-tracker/commit/761e389518f701f12de6e5ec62b558391d169e66))
* **insights:** delta tint floor set per theme, at least 10 from gray ([62f4441](https://github.com/eric-maydeck/bean-tracker/commit/62f4441f7b817b7168a7e82c0563023950c376e7))
* **insights:** empty heat cell tip says no brews ([722f824](https://github.com/eric-maydeck/bean-tracker/commit/722f82426613929f5d2311043c7d0145d9118a08))
* **insights:** every tip and help popover shares one titled format ([c916d2e](https://github.com/eric-maydeck/bean-tracker/commit/c916d2ebab184c3854a06e9286bdc1d170f4dd59))
* **insights:** final review fixes (series color, ordered trim, pair slug, a11y) ([42b75a1](https://github.com/eric-maydeck/bean-tracker/commit/42b75a16b10636c635e1b80b668ab58e2806303b))
* **insights:** gear matrix fills the shorter board's column ([95d49be](https://github.com/eric-maydeck/bean-tracker/commit/95d49be33019ad1b4c0c58760f44ea2c605de5e3))
* **insights:** give mineral cards their own anchor ids, clear of the GH section ([c29c0c2](https://github.com/eric-maydeck/bean-tracker/commit/c29c0c26cf24eb648a820a748c6b9764f808b3bb))
* **insights:** grind bands never skip a step inside their range ([bf54b42](https://github.com/eric-maydeck/bean-tracker/commit/bf54b426ec2615aead283e00c224c1e120ac1234))
* **insights:** habits heatmap and calendar tips use label value rows ([422ff67](https://github.com/eric-maydeck/bean-tracker/commit/422ff67e108997504e33d43ca296757f6623a2c3))
* **insights:** heatmap row labels outside the scrolling plot; opaque mineral names ([816c45c](https://github.com/eric-maydeck/bean-tracker/commit/816c45c8f449547bda322061bca36e74b3da17ba))
* **insights:** help popovers hold six short lines at most ([764d137](https://github.com/eric-maydeck/bean-tracker/commit/764d137bf2508a8878fc7525d6a56797fc19b5ef))
* **insights:** lab boards rank solid before thin; faded rest curve needs 3 bags ([fdde254](https://github.com/eric-maydeck/bean-tracker/commit/fdde254d758b6ffb818c9cffd5ed98f58f005d6d))
* **insights:** lab Bonferroni test counts, paired spread, bag-weighted usual mean ([8815676](https://github.com/eric-maydeck/bean-tracker/commit/88156761dc2c8ac0911acd12f77b16279255e901))
* **insights:** lab charts guard empty data, announce line tips, tidy markup ([21e9754](https://github.com/eric-maydeck/bean-tracker/commit/21e97548b8c9343d9bf4b73bdcc66b26f36b0504))
* **insights:** lab picks stay in the url through non-lab tabs ([341c30a](https://github.com/eric-maydeck/bean-tracker/commit/341c30a8fd335819d9b2487e228e803a0a4013d5))
* **insights:** lab wording, top bags help, shared grinder select, brewing empty state ([a7ab00f](https://github.com/eric-maydeck/bean-tracker/commit/a7ab00fc95f305baef11b76cecbc98565c36f77b))
* **insights:** mineral map no match keeps the vs usual column narrow ([39f6fe2](https://github.com/eric-maydeck/bean-tracker/commit/39f6fe2a1045ebd8e85cb7df2d8c9a077cdb4521))
* **insights:** mineral map tip opens from the name, vs usual is a chip ([3edafe6](https://github.com/eric-maydeck/bean-tracker/commit/3edafe6362f162d6a7be2d396b8b408b49853bea))
* **insights:** one color per recipe across the water tab, ten slots ([f7c74c0](https://github.com/eric-maydeck/bean-tracker/commit/f7c74c0eedfca599a5b91ac586696c8e06a145ec))
* **insights:** other tip lists members indented under other ([9c4bdd6](https://github.com/eric-maydeck/bean-tracker/commit/9c4bdd6db2929c574420d695cbaeb043b21a3dd6))
* **insights:** other tips show a lone leftover instead of +1 more ([c9d420d](https://github.com/eric-maydeck/bean-tracker/commit/c9d420d64abd6560bd1e0b8ce71c2c9978073615))
* **insights:** pair headers get wider columns and clamp to two lines ([ce5c4e4](https://github.com/eric-maydeck/bean-tracker/commit/ce5c4e43643fe94df006c3f00a988fbd12f3c08c))
* **insights:** phone card grids hold two per row, odd last spans ([185fc33](https://github.com/eric-maydeck/bean-tracker/commit/185fc335c05f0359bfcae4f2d032316a00950101))
* **insights:** rest centre uses banded brews; shared lab number formats and section header ([7da746c](https://github.com/eric-maydeck/bean-tracker/commit/7da746c767e321ef051e6b6b2569e7b79007369e))
* **insights:** sd and green/red help tips put each state on its own line ([73f84ca](https://github.com/eric-maydeck/bean-tracker/commit/73f84caa248fa0497fac87db19a61d60815ac7d1))
* **insights:** sd help tip opens on keyboard focus ([50f7f27](https://github.com/eric-maydeck/bean-tracker/commit/50f7f27abd5d662ae3fd1e5bb83ec353885287c0))
* **insights:** series colors stay clearly distinct, checked by delta e ([ffbfdf4](https://github.com/eric-maydeck/bean-tracker/commit/ffbfdf4385159483849ef17eb444d3c7ad8390a9))
* **insights:** seven recipe colors, every two at least 20 apart; drop duplicate dark slots ([a39525a](https://github.com/eric-maydeck/bean-tracker/commit/a39525a58326c5656ae62553241a100756bf547a))
* **insights:** signed rating deltas read green or red as text ([8a9c3fc](https://github.com/eric-maydeck/bean-tracker/commit/8a9c3fc7b4db2c29868c95cbbce7d411bc4f56a0))
* **insights:** stacked gear columns share the paired-chart height cap ([34e08c3](https://github.com/eric-maydeck/bean-tracker/commit/34e08c30ee555e0038c6225296e64994602f8298))
* **insights:** sweet spot chart keys start at the winning band ([d5c4925](https://github.com/eric-maydeck/bean-tracker/commit/d5c492561cd0bebc674bbb09d47547fcd1095c30))
* **insights:** sweet spot charts work from the keyboard ([a8ec6b7](https://github.com/eric-maydeck/bean-tracker/commit/a8ec6b7e3f6794713e3653f03bafe0cd00ee2336))
* **insights:** sweet spot twin tags lead the sub line; charts scale to solid bands ([168f0c8](https://github.com/eric-maydeck/bean-tracker/commit/168f0c82dea1314e91777ffd2ce4b3ceb2771dfc))
* **insights:** sweet spots grind card spans every setting brewed ([773c50c](https://github.com/eric-maydeck/bean-tracker/commit/773c50c4d1ffcab87a96e42ca61b7fc2ffe676fe))
* **insights:** thin rows keep their delta's green or red ([c3cd7ac](https://github.com/eric-maydeck/bean-tracker/commit/c3cd7ac175bea2d146c9060910ea60b78fec0c3b))
* **insights:** truncated pair names stay keyboard-focusable ([91b43bc](https://github.com/eric-maydeck/bean-tracker/commit/91b43bc2817ff95c01886943284fe2a8287e8c63))
* **insights:** usage tips show name and share, other lists its members ([9a44471](https://github.com/eric-maydeck/bean-tracker/commit/9a4447108a2e5ee66d4d732a212717505a64495e))
* **insights:** versus side labels tighten with the card ([b7c26c3](https://github.com/eric-maydeck/bean-tracker/commit/b7c26c311aaf85cb8ff752e81ccfaa9095845458))
* **insights:** versus sides in the full-text popover and title ([cd0ca23](https://github.com/eric-maydeck/bean-tracker/commit/cd0ca23e5f989feb6946ea5f286badd61b0817cf))
* **insights:** water pair recipes never share a color ([4fd4542](https://github.com/eric-maydeck/bean-tracker/commit/4fd45422dc52bcb33468cd8cf95f1e241afe8bdb))
* **insights:** water pairs flow by column, one-line headers with tip, roaster · name ([80c2529](https://github.com/eric-maydeck/bean-tracker/commit/80c2529816c3c7cee27c9862d26e310a1400c043))
* **insights:** water pairs flow in balanced columns ([59a29cd](https://github.com/eric-maydeck/bean-tracker/commit/59a29cdba8cc75d40af89675808a72316a3e9bd6))
* **insights:** water pairs get recipe column headers and bordered blocks ([2f3d86e](https://github.com/eric-maydeck/bean-tracker/commit/2f3d86e63cea961b9204259171a968277b95b881))
* **insights:** water pairs tag repurchases; shared hint badge and heatmap fill ([c55a2ff](https://github.com/eric-maydeck/bean-tracker/commit/c55a2ffad5002ec6946382194346e242a161c882))
* **lab:** a focus tip survives the page scrolling under the mouse ([f215338](https://github.com/eric-maydeck/bean-tracker/commit/f2153388e64ce06cb83503b539b44d313bd81778))
* **lab:** brewing headings are h2 siblings, mineral dots tick every shown value ([0aae897](https://github.com/eric-maydeck/bean-tracker/commit/0aae8972257a8a562eb8cb0bf1956fa088a66b31))
* **lab:** mineral dots are 44px tap targets ([1954790](https://github.com/eric-maydeck/bean-tracker/commit/19547906be732aed979a673597fcf921b936d656))
* **lab:** never leave out a solid mineral point ([f7fc5b1](https://github.com/eric-maydeck/bean-tracker/commit/f7fc5b1fd56a3c1f17844aa4b3c121f75adc4131))
* **lab:** one green/red pair for bars and heatmaps, neutral drift, dark-mode faded tones ([45831b0](https://github.com/eric-maydeck/bean-tracker/commit/45831b007827827719eca6fbd6ff7f36aa3340d6))
* **lab:** paired cards share a fitted height, the taller scrolls inside ([5607387](https://github.com/eric-maydeck/bean-tracker/commit/560738778cf92c4d78330ac50c794172bee6913e))
* **lab:** reachable segments and dots, left-out mineral notes, show all bags per water pair ([5bbf63a](https://github.com/eric-maydeck/bean-tracker/commit/5bbf63a955860dabc4b192e4f2a11ffd74c975c5))
* **tips:** untitled chart tips keep all rows; close on rebuild, escape, scroll away ([36ae9d0](https://github.com/eric-maydeck/bean-tracker/commit/36ae9d009eba1e6ce100c213e42290792f99efc9))


### Features

* **insights:** 21-slot recipe palette in three tones; ink-colored pair headline ([e47e537](https://github.com/eric-maydeck/bean-tracker/commit/e47e537dd10cf8323861da4bc38f584af5a524ed))
* **insights:** band/exact url param per brewing chart ([21718a3](https://github.com/eric-maydeck/bean-tracker/commit/21718a3624cf6e001bd8026c0497fb6e517512e5))
* **insights:** brew temperature fact and brewing lab bands ([a8803d6](https://github.com/eric-maydeck/bean-tracker/commit/a8803d6c770432e567620a68587d93a9fdfa8689))
* **insights:** brewing lab tab builder ([25d69b3](https://github.com/eric-maydeck/bean-tracker/commit/25d69b3e231daaf7af9cacc06d71176064d5a8f3))
* **insights:** brewing lab tabs and url params ([6b88d99](https://github.com/eric-maydeck/bean-tracker/commit/6b88d995400907cb30a4b89302bb477fba96ce9a))
* **insights:** brewing tab ([db6a07b](https://github.com/eric-maydeck/bean-tracker/commit/db6a07befb43f1ba58615dad0dd8c00e101b0ecc))
* **insights:** brewing thin cells faded, rest curve by bag, unpaired bands dropped ([6f489fd](https://github.com/eric-maydeck/bean-tracker/commit/6f489fd142a91be736357fb4dcd4dcfc9e461a49))
* **insights:** gear tab ([c2af0be](https://github.com/eric-maydeck/bean-tracker/commit/c2af0bea2c5312eafcc0474a0ef03eb0f4bf5bc0))
* **insights:** lab chart pieces: delta bars, line chart, diverging heatmap ([974986e](https://github.com/eric-maydeck/bean-tracker/commit/974986eb1ccf2613b551b9512375de6191003a8b))
* **insights:** load the brewing lab tabs per tab ([fff86bf](https://github.com/eric-maydeck/bean-tracker/commit/fff86bf372a6d46d08c6e7f0281edf0e84d8d0f2))
* **insights:** same-bag deltas, sweet-spot ladder and breakdowns ([07a57c3](https://github.com/eric-maydeck/bean-tracker/commit/07a57c39f1a4f3d97e738da33ec6b3482cd53fa6))
* **insights:** sweet spot cards chart their evidence ([cae0a94](https://github.com/eric-maydeck/bean-tracker/commit/cae0a9404cdd20d87138c55ec8f68d3bd4b413fc))
* **insights:** sweet spot evidence bands and distinct top bag names ([81ab863](https://github.com/eric-maydeck/bean-tracker/commit/81ab8636f92dca9d28ad253f5053a082a1ee7673))
* **insights:** sweet spots builder and lab picker options ([1b34146](https://github.com/eric-maydeck/bean-tracker/commit/1b341462bb0c9baae67210131ae473a6334ecdda))
* **insights:** sweet spots tab ([667db7f](https://github.com/eric-maydeck/bean-tracker/commit/667db7f2e5138a4a99358c3fabfd50bf85e50f69))
* **insights:** two-tone site-wide categorical palette, neutral other gray, a vs b pair headings ([c8ddd95](https://github.com/eric-maydeck/bean-tracker/commit/c8ddd95c9518055d785bc0dcb30c36dc1cb6468a))
* **insights:** water and gear lab tab builders ([8800c32](https://github.com/eric-maydeck/bean-tracker/commit/8800c32661ee27a21e996fb08467bdf99b2577b3))
* **insights:** water tab ([4af4831](https://github.com/eric-maydeck/bean-tracker/commit/4af4831f4bb41ead82e8225ac61ce0b63b5c8d4e))
* **lab:** board value columns and short spot tips ([c247fff](https://github.com/eric-maydeck/bean-tracker/commit/c247fffb62e3ce57b7057e7b45138e9f26c4c467))
* **lab:** chart tips in the top layer, never clipped; spaced stacked bars with other contents ([b1ba6a4](https://github.com/eric-maydeck/bean-tracker/commit/b1ba6a45c4dc85f566a715d9c5665c09ccfc7d51))
* **lab:** drop all-blank heatmap rows/columns, leave out far-above mineral points, pairs url param ([f621d9e](https://github.com/eric-maydeck/bean-tracker/commit/f621d9ee8af88ab5fb9c6c4d95c4d2dbdc1d6f10))
* **lab:** fixed absolute delta color scale, stretched bars scale up ([a05e964](https://github.com/eric-maydeck/bean-tracker/commit/a05e964a8b98b0193181481956aec815842e30a1))
* **lab:** fixed brewing layout, rest heatmap, mineral dots, grouped water pairs, gear titles ([13c1782](https://github.com/eric-maydeck/bean-tracker/commit/13c178226ac0ebeb968d8ab5ace2c0ed164d5ee4))
* **lab:** green/gray/red diverging scale, structured tips, no match label ([7bb90de](https://github.com/eric-maydeck/bean-tracker/commit/7bb90ded0390237dcc298f3f07e456d0a8c32dfd))
* **lab:** grind band labels with ranges, no-match grind bands, eras other contents ([e0fd60c](https://github.com/eric-maydeck/bean-tracker/commit/e0fd60c866ab1c9e0714b61bd4a880600c0b4c4c))
* **lab:** preview round 1 data shapes (exact modes, bands, sd, heatmaps, pairs) ([dc4cfa1](https://github.com/eric-maydeck/bean-tracker/commit/dc4cfa1f62bf350f8e0c8cb81795bf1ecd1c2789))
* **lab:** recipe mineral map rows replace per-mineral points ([116455d](https://github.com/eric-maydeck/bean-tracker/commit/116455d4d727a2db1619c25ff65379e7490b8059))
* **lab:** recipe mineral map, water pair colors, SD help tips ([f1d55f5](https://github.com/eric-maydeck/bean-tracker/commit/f1d55f5fe59e4df2aa7ff97d5e7c7b295cca87d7))
* **lab:** usage over time as 100% stacked bars, smooth trend lines ([b1d7939](https://github.com/eric-maydeck/bean-tracker/commit/b1d79390015616e5721efa196818302c4b02f73b))

# [1.73.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.72.0...v1.73.0) (2026-10-12)


### Bug Fixes

* **insights:** calibration full months, shared groupBy and grindValue ([886682a](https://github.com/eric-maydeck/bean-tracker/commit/886682a553e90b9471e01f8fb84f467d46fe4ff9))
* **insights:** clamped tap opens the full text, no $0 spend, B7 test ([5ab3014](https://github.com/eric-maydeck/bean-tracker/commit/5ab30147f4f6a867c5881710ba28e9ac16cc63c9))
* **insights:** co-ferment details label reads Process ([29ecf7f](https://github.com/eric-maydeck/bean-tracker/commit/29ecf7f4d16b502d6061546520920d43017324ba))
* **insights:** deck bucketed on the server, shared spend, what-if and caveat fixes ([09ce13e](https://github.com/eric-maydeck/bean-tracker/commit/09ce13e5793ba22c8bf906f2eb6a6b212d91f79b))
* **insights:** fuller what-if cards, no 0.00 findings or giant settle counts ([d0d030d](https://github.com/eric-maydeck/bean-tracker/commit/d0d030d1bb9c488e54485dd927d617933acc27b2))
* **insights:** match spec definitions on prod data ([d62c46e](https://github.com/eric-maydeck/bean-tracker/commit/d62c46eeea8372f84e3ae6d53c2d2082c5423689))
* **insights:** on-hand lists from all brews, bonferroni wildcard, sample sd ([04e4e58](https://github.com/eric-maydeck/bean-tracker/commit/04e4e58da32476b4ef33aaadf84f5d393f714b83))
* **insights:** return the full grid, drop fillRows and splitRows ([a240cb5](https://github.com/eric-maydeck/bean-tracker/commit/a240cb53235b4560773ece250201bd464dd9e3f4))
* **insights:** runway uses consumption, stricter minimums for generators ([13530e5](https://github.com/eric-maydeck/bean-tracker/commit/13530e5e6efeae3e277e6f3d106d77cdd8838ea8))
* **insights:** weekday side first, weekends over the Sat/Sun bars ([77def91](https://github.com/eric-maydeck/bean-tracker/commit/77def9180249bbefd61a55bc53fb6343a919805d))


### Features

* **insights:** details fill spare row height only ([7c8aa87](https://github.com/eric-maydeck/bean-tracker/commit/7c8aa87fcc66d192b8df4642ba8f8c57034d3080))
* **insights:** generator registry with dial-in, taste and runway findings ([fdff432](https://github.com/eric-maydeck/bean-tracker/commit/fdff432e19f79d0c540857fc2323abd38b4beba6))
* **insights:** habits, gear, money and myth findings ([21bc4b1](https://github.com/eric-maydeck/bean-tracker/commit/21bc4b140a9f3f0c5fe60c3d298ba2536a39d245))
* **insights:** insights tab bucketing and what-if math ([ac79e92](https://github.com/eric-maydeck/bean-tracker/commit/ac79e9292154fde440fc634d865262b28a70efff))
* **insights:** insights tab params and load ([48f66ef](https://github.com/eric-maydeck/bean-tracker/commit/48f66ef33beeb6cef21e3ee5bac23e2c75ff3dda))
* **insights:** insights tab ui ([8faa812](https://github.com/eric-maydeck/bean-tracker/commit/8faa8128dfc36c0b8efbf761c2b24780385251e8))
* **insights:** multi-line charts, details lists, too-early meters, wrapping versus cards ([a0ab1d6](https://github.com/eric-maydeck/bean-tracker/commit/a0ab1d678242e14b985661538385427c88997bac))
* **insights:** notes, brew index, bag rating facts and stats helpers ([f344ccb](https://github.com/eric-maydeck/bean-tracker/commit/f344ccb7aa55c3c69f233c50f3dd2e7734603268))
* **insights:** rule-based findings card sizes ([a7b0f39](https://github.com/eric-maydeck/bean-tracker/commit/a7b0f3914e9c0ccee385072a31c8a912c0910095))
* **insights:** runway lists the oldest bags on hand ([b5b8dd6](https://github.com/eric-maydeck/bean-tracker/commit/b5b8dd6cd3b3f7faaceb8dbf2650c6f4b66f7126))
* **insights:** supporting detail lists on descriptive and number cards ([a929f53](https://github.com/eric-maydeck/bean-tracker/commit/a929f53f0abc90847eb28e1f24e00d7ad3e6056f))
* **insights:** trend charts, multi-line gear shares and too-early progress ([5227a6f](https://github.com/eric-maydeck/bean-tracker/commit/5227a6f97cc95359b5f26743c2b029e49de3ce06))
* **insights:** weekday bar chart ([9a8a76f](https://github.com/eric-maydeck/bean-tracker/commit/9a8a76f838157fcfcd968da7083f65082f010397))
* **insights:** weekday bars, 2-item details, dial-in speed details ([00762f2](https://github.com/eric-maydeck/bean-tracker/commit/00762f2810344ee17a00c42a21150a7a9238e540))

# [1.72.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.71.0...v1.72.0) (2026-10-12)


### Bug Fixes

* **insights:** brews rated 9+ follow current/all; on this day skips brews with no coffee ([3500d41](https://github.com/eric-maydeck/bean-tracker/commit/3500d4142c924fe1c35e4ad6c096772f06ca2de3))
* **insights:** feed dates beside titles, milestone wording, records polish ([c0116b8](https://github.com/eric-maydeck/bean-tracker/commit/c0116b817b5377e7e892debd1d4cfb2f372c7372))
* **insights:** hide the side ruler by screen height only, never on scroll ([6ef67ff](https://github.com/eric-maydeck/bean-tracker/commit/6ef67ff982fb07645dad775c26c35983f887d112))
* **insights:** milestone wording for type firsts and busiest day, round kg ([2741ded](https://github.com/eric-maydeck/bean-tracker/commit/2741ded6a672a7e72997626ed91253826d78d625))
* **insights:** no lone record cards, 2-line names, spec deltas and hole-in-one ([e65f373](https://github.com/eric-maydeck/bean-tracker/commit/e65f37384624c6f4e4f92be75a6fe995aabd7a58))
* **insights:** period-scope bag price records, format buying month spend ([8361d47](https://github.com/eric-maydeck/bean-tracker/commit/8361d475ec08ab3b99e7af5c079d69e5bf48f675))
* **insights:** phone strip waits for a tap or sideways drag; end drags on lost capture ([2b5a6c7](https://github.com/eric-maydeck/bean-tracker/commit/2b5a6c71a4ab4a0fad23adfb6a44b57e05e6f2cc))
* **insights:** records all-time badge, after-midnight night owls, ties once per bag ([dd865a1](https://github.com/eric-maydeck/bean-tracker/commit/dd865a1ca12d984bd7dc6399b207b1efefc09a2a))
* **insights:** records round 2 wording, hover tips, badge tip ([d4dd47d](https://github.com/eric-maydeck/bean-tracker/commit/d4dd47d14f331f57cca83dd0a5fcb46f8186ef76))
* **insights:** sum milestone weights in grams, reuse isFinished ([2c94310](https://github.com/eric-maydeck/bean-tracker/commit/2c943109c7afc23751b82090931471d0c61359ca))
* **insights:** tab switch drops the old tab's anchor; tidy page leftovers ([37a74e2](https://github.com/eric-maydeck/bean-tracker/commit/37a74e216480aeaebd07ca06fac20ec74c31d5e7))
* **insights:** taste ties go to the higher-rated roaster, then a–z ([c46c978](https://github.com/eric-maydeck/bean-tracker/commit/c46c9782f15901ac80ac7920984272f82d1d1eee))


### Features

* **insights:** brewer, brewer type, water, ratio and grind on brew facts ([f4b0c5a](https://github.com/eric-maydeck/bean-tracker/commit/f4b0c5a63dedfed3ae95cc2ef9bc8d529894bb44))
* **insights:** caffeine filter, top 20 and clearer records ([3558a57](https://github.com/eric-maydeck/bean-tracker/commit/3558a57f2a6709a3fa94e78cdf9151773da5f17b))
* **insights:** firsts, bests, gear and anniversary milestones ([4e6008c](https://github.com/eric-maydeck/bean-tracker/commit/4e6008c6676baa3d96681fd3a57ec566ee4baa22))
* **insights:** fixed-size ruler thumb, month anchors, ruler fits the feed, closes [#m-YYYY-MM](https://github.com/eric-maydeck/bean-tracker/issues/m-YYYY-MM) ([6287c1b](https://github.com/eric-maydeck/bean-tracker/commit/6287c1b71020feb71eb75263a4651bf2566f3eb0))
* **insights:** freshness, money, brew extremes and gentle records ([5b0d2ff](https://github.com/eric-maydeck/bean-tracker/commit/5b0d2ff55e15fe5a9a73baf37521af7a6d024466))
* **insights:** hide the side ruler when too little room is left ([e5fb891](https://github.com/eric-maydeck/bean-tracker/commit/e5fb891a4ed3ebee976eff63597acc30e337b051))
* **insights:** linked tile names on every tab, card hover tint ([a2c067b](https://github.com/eric-maydeck/bean-tracker/commit/a2c067b2509c8de1f2e62ceaa9bdb1af2e36245d))
* **insights:** load records and milestones per tab; seed soup and decaf ([b456432](https://github.com/eric-maydeck/bean-tracker/commit/b456432cde6bdb19bafbf265192991cebc410eff))
* **insights:** milestone ladders, count and streak events ([425417b](https://github.com/eric-maydeck/bean-tracker/commit/425417b3b61734f0a6511adc32be84c148f70c89))
* **insights:** milestone totals, timeline navigator, coffee links, kind colours ([943b4c8](https://github.com/eric-maydeck/bean-tracker/commit/943b4c870f309da267afce126c7ce33e10412b2e))
* **insights:** milestones timeline ruler with current-month marker ([76314c1](https://github.com/eric-maydeck/bean-tracker/commit/76314c16057a6241ea02a3d08bd2394722029868))
* **insights:** records anchors, caption links and tighter tiles ([d80cb46](https://github.com/eric-maydeck/bean-tracker/commit/d80cb46d2cecd184a8eac36728a95e59a7161258))
* **insights:** records and milestones tabs ([71e36f1](https://github.com/eric-maydeck/bean-tracker/commit/71e36f186aeda2e95805052c7b9271d8ff8017e8))
* **insights:** records and milestones tabs, brewer and kinds params ([29f6806](https://github.com/eric-maydeck/bean-tracker/commit/29f68063bfd43e934a037307dbc36f9c0707968f))
* **insights:** records engine with taste and volume records ([52e5507](https://github.com/eric-maydeck/bean-tracker/commit/52e5507f37175145b78a4733153ba335619b3132))
* **insights:** ruler sub-ticks, viewport band, scrub and relative jumps ([d324226](https://github.com/eric-maydeck/bean-tracker/commit/d324226bbc353127b5f4f73a540b68ab68ce3962))
* **insights:** top brews to 50, compare line names its window ([f7d16f7](https://github.com/eric-maydeck/bean-tracker/commit/f7d16f774d59488dbe85de9db714982d8b113ec5))
* **insights:** top coffees list, show less first, espresso tile names ([6dd91d8](https://github.com/eric-maydeck/bean-tracker/commit/6dd91d847f9a63aa7dba07c7479c8842ee3e79d9))

# [1.71.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.70.0...v1.71.0) (2026-10-11)


### Features

* **coffees:** coffee added popup with open, add coffee on the coffee page ([949c49e](https://github.com/eric-maydeck/bean-tracker/commit/949c49e935a1b7d2e3acf2c94c1e5ea6ca37b9d5))
* **coffees:** popup at the top, 5s on touch screens, 2s minimum after a pause ([18ee78f](https://github.com/eric-maydeck/bean-tracker/commit/18ee78fe382fb2b0e80b0a4cfb66c2fafee0dfee))

# [1.70.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.69.0...v1.70.0) (2026-10-11)


### Bug Fixes

* **insights:** busiest day compare line is one line, wraps after the colon only if it must ([25890e9](https://github.com/eric-maydeck/bean-tracker/commit/25890e977fc9deaa59a0f3ce06499868060bd1e4))
* **insights:** busiest day compare reads this day first, comparison small and muted below ([c436b77](https://github.com/eric-maydeck/bean-tracker/commit/c436b77d1be8c3d8f7d0b0894269ef84494a9066))


### Features

* **insights:** busiest day compare shows the comparison day's brews and grams ([990c366](https://github.com/eric-maydeck/bean-tracker/commit/990c366f044502e7a338f9cac274e1fc8088b222))
* **insights:** busiest day tile under avg per day, replaces the avg per week hack ([cb71dd1](https://github.com/eric-maydeck/bean-tracker/commit/cb71dd180c04e12d055f1e6dd13e89bd543dbe06))

# [1.69.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.68.0...v1.69.0) (2026-10-11)


### Bug Fixes

* **insights:** backlog counts bags with no roast date as on hand ([6cb1a1a](https://github.com/eric-maydeck/bean-tracker/commit/6cb1a1a6428b6d666e9a35d370f6e131254d5f79))
* **insights:** busiest weekday sub drops the weekday ([f111a03](https://github.com/eric-maydeck/bean-tracker/commit/f111a03247d3549d7eaaeab6ad9875e1d18fb9b9))
* **insights:** calendar scale, legend labels tested, tooltip units ([498df6b](https://github.com/eric-maydeck/bean-tracker/commit/498df6b461c08ce59398ca9f0ddb0aa102236453))
* **insights:** final review fixes, shared css and weekday names, avg per week tile, a11y labels ([6422cdc](https://github.com/eric-maydeck/bean-tracker/commit/6422cdc5dd14d9d9afc62de083e9d48bc4185304))
* **insights:** habits calendar, no-data cells, rating axis, keyboard grids ([9823688](https://github.com/eric-maydeck/bean-tracker/commit/9823688a80c4c7142cf48dcd1fe40c7a8c719b09))
* **insights:** keep the view, period and compare labels on their original line height ([3179108](https://github.com/eric-maydeck/bean-tracker/commit/3179108704580424be00dac16a4682381d6ee648))
* **insights:** kept sub line stacks under the delta ([3518e8d](https://github.com/eric-maydeck/bean-tracker/commit/3518e8d70a7a84cea7cf484136756f4c5d2a997b))
* **insights:** monotone on-hand line, whole-number count ticks, aligned chart pair ([22d97aa](https://github.com/eric-maydeck/bean-tracker/commit/22d97aa00c4209c870cfda27b28233cba40b03de))
* **insights:** no data means nothing tracked for bounded periods ([8659d19](https://github.com/eric-maydeck/bean-tracker/commit/8659d1962e51efa52530429e5a254dc0684b0965))
* **insights:** one group label style, named groups, hover tip flag, filter match label ([17ab1f8](https://github.com/eric-maydeck/bean-tracker/commit/17ab1f8cf96e055e87b039803e99848d77bf68cc))
* **insights:** one group-field label style, shared ctl-select on date inputs, tidy on-deck ([320f5d0](https://github.com/eric-maydeck/bean-tracker/commit/320f5d0cbd5353e7c4da660774c76632e2c6e127))
* **insights:** pace the weekday compare sums like the hour ones ([b72c02c](https://github.com/eric-maydeck/bean-tracker/commit/b72c02cb03140f3de687ff4f80d27a85d4a3a161))
* **insights:** paced deltas, screen-reader delta text, shorter weekday sub, tested reset ([af14c63](https://github.com/eric-maydeck/bean-tracker/commit/af14c6338e9d163216b2170d6ab56389cb325b55))
* **insights:** partial buckets show their days, compare average line shows dates ([d4184a0](https://github.com/eric-maydeck/bean-tracker/commit/d4184a03c2f5d8987c8f89878204590877ff2bf0))
* **insights:** ratio delta wraps at full size, says points, singular day ([484b79d](https://github.com/eric-maydeck/bean-tracker/commit/484b79dea8ac9d24e810fd07ed3c04b60995bf93))


### Features

* **coffees:** show and view toggle groups get labels ([2ae5c52](https://github.com/eric-maydeck/bean-tracker/commit/2ae5c524686fd9b24149d446185c4fdd97bc360e))
* **insights:** 12-hour clock for hours on insights ([21bcdc1](https://github.com/eric-maydeck/bean-tracker/commit/21bcdc1ec43ff1d6d70722d3904e14135a9e96fb))
* **insights:** brew calendar shows the latest 24 months ([d1f6883](https://github.com/eric-maydeck/bean-tracker/commit/d1f6883de46ba684ccba99de38fe96e6bb9df5e5))
* **insights:** busiest weekday tile shows its average ([c90e024](https://github.com/eric-maydeck/bean-tracker/commit/c90e0244a6642c813702ac78483eda90a71fd320))
* **insights:** compare bars name the dates they cover ([a8d1c87](https://github.com/eric-maydeck/bean-tracker/commit/a8d1c87239e328bc4a2edd3596ea3f593f8ae194))
* **insights:** consumption average or total toggle ([9ddda96](https://github.com/eric-maydeck/bean-tracker/commit/9ddda96298bc85cfe0e9eb41fc79a6fd61fa7cc2))
* **insights:** consumption engine ([95ba596](https://github.com/eric-maydeck/bean-tracker/commit/95ba596e49cffc0891d22b08cad7fb500035664b))
* **insights:** consumption tab ([59af126](https://github.com/eric-maydeck/bean-tracker/commit/59af12691ee726dcc015a25ebcb693bcab647dc7))
* **insights:** custom range for the period dropdown ([57bbdb3](https://github.com/eric-maydeck/bean-tracker/commit/57bbdb33fcdb24ea47dc0ee92cb788e2145c5927))
* **insights:** delta lines show direction and the previous value ([6fbf637](https://github.com/eric-maydeck/bean-tracker/commit/6fbf63712a8f8e6267b86d3016d58d2ef8b84d2e))
* **insights:** every toggle group gets a small label ([d1f1fc3](https://github.com/eric-maydeck/bean-tracker/commit/d1f1fc37c06a949a3ed0130fa7af40a8791307e8))
* **insights:** explanation tips also open on mouse hover ([3cce5a7](https://github.com/eric-maydeck/bean-tracker/commit/3cce5a7002796e3ff203d938c8c03d69a8389e01))
* **insights:** habits and consumption tabs, right now panel ([fc85aee](https://github.com/eric-maydeck/bean-tracker/commit/fc85aeeff003e81a0157c54c965f502a7e45991e))
* **insights:** habits and consumption url params ([1a77fa6](https://github.com/eric-maydeck/bean-tracker/commit/1a77fa6bcefa219573ed4e8a5ff8b952605d28ba))
* **insights:** habits engine ([42f7326](https://github.com/eric-maydeck/bean-tracker/commit/42f7326ec44e00c0ea506f0b76d752dcd888a290))
* **insights:** habits show avg per day or total ([47504db](https://github.com/eric-maydeck/bean-tracker/commit/47504dbe4792ea0ac1e8e369453ccb16f2e491dc))
* **insights:** habits tab ([bdb218a](https://github.com/eric-maydeck/bean-tracker/commit/bdb218a9f495cde8e7f7e30316e18b2fc28d9084))
* **insights:** legends named for the period and compare labels ([1291e46](https://github.com/eric-maydeck/bean-tracker/commit/1291e46559fb674c3145fe9925aa18a8a96f7a42))
* **insights:** ratio tiles show the previous count with their percent ([0688b8d](https://github.com/eric-maydeck/bean-tracker/commit/0688b8d30a00c3d6a9b57c5ff4921b59291d8d16))
* **insights:** remaining grams on hand, right-now snapshot, back-filled flag ([b7997b0](https://github.com/eric-maydeck/bean-tracker/commit/b7997b08b3632a5bd5056c050533a1e41455e68f))
* **insights:** reset button clears every choice ([7458fd6](https://github.com/eric-maydeck/bean-tracker/commit/7458fd637c9205343ad4cfe0212990e3c8ed2870))
* **insights:** score info shows a hover tip, stale hover flag fixed ([24a8d9e](https://github.com/eric-maydeck/bean-tracker/commit/24a8d9eb2f7415293292a941a9cf73c7ab28d2e9))
* **insights:** tab choices stay when switching tabs ([5634030](https://github.com/eric-maydeck/bean-tracker/commit/56340300d56abf43351ffe7d5890fa7f88c43f82))
* **on-deck:** currently open and next up split into two views ([61c3525](https://github.com/eric-maydeck/bean-tracker/commit/61c352562073a3d90afdd7e0b168dd506195195b))

# [1.68.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.67.0...v1.68.0) (2026-10-11)


### Features

* **insights:** spend and grams in the $/g leaderboard rows ([ccf7605](https://github.com/eric-maydeck/bean-tracker/commit/ccf7605a15bdad01aa5e99c31d55b22773c7f68e))

# [1.67.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.66.0...v1.67.0) (2026-10-11)


### Bug Fixes

* **insights:** 44px tap target for leaderboard row links ([684dec6](https://github.com/eric-maydeck/bean-tracker/commit/684dec6090fa61604081529981accb7de8d0b3c7))
* **insights:** map svg role group, align dark tokens ([89e5eb8](https://github.com/eric-maydeck/bean-tracker/commit/89e5eb869fe86568fa375c8e2aaeda309930331c))
* **insights:** stretch leaderboard row link over the whole row ([addff34](https://github.com/eric-maydeck/bean-tracker/commit/addff3403e165337c0a92fbc611f88b008be39cc))


### Features

* **insights:** average switch for rating boards (raw, light, strong) ([ce0dca8](https://github.com/eric-maydeck/bean-tracker/commit/ce0dca86c743fc4bdab0eec92e1fb63ca3183b03))
* **insights:** best adjusted (light) is the default score ([a78cb1d](https://github.com/eric-maydeck/bean-tracker/commit/a78cb1d6fe4733436e35036f7ad383af01351a8b))
* **insights:** dialed in scores and a how scores work dialog ([af49997](https://github.com/eric-maydeck/bean-tracker/commit/af49997258b2a4b099f9d590f2df0bcb09e18b41))
* **insights:** grinder and bag name, slug, processing in facts ([3b974ce](https://github.com/eric-maydeck/bean-tracker/commit/3b974cec4c791bb45b8be2bda7866a8ceb78b5c6))
* **insights:** leaderboard cards with rank by, movement and show all ([537ac94](https://github.com/eric-maydeck/bean-tracker/commit/537ac94fad67f501c7871fe3c56f07876cd784c0))
* **insights:** leaderboard ranking with movement vs compare ([6f872e9](https://github.com/eric-maydeck/bean-tracker/commit/6f872e9b0209d29cc91b7d00e6cb0c8eb44f1038))
* **insights:** natural earth world map shapes and origin iso lookup ([d03c7c3](https://github.com/eric-maydeck/bean-tracker/commit/d03c7c342c478c31b96ffe38eacd52422f9b7cd2))
* **insights:** origin world map with themed tooltip ([8a86ada](https://github.com/eric-maydeck/bean-tracker/commit/8a86ada53e624c38eaedbd5709ac3f946d02d061))
* **insights:** overview and leaderboards tabs ([58e9839](https://github.com/eric-maydeck/bean-tracker/commit/58e9839fef54a2e6bb0aa8fe57988b8b20aeb7f1))
* **insights:** rank by dropdown, seven score modes, stronger value bars ([806a683](https://github.com/eric-maydeck/bean-tracker/commit/806a683edd2538a037cc686a51e12e0d58e5140a))
* **insights:** score dropdown with a best brew mode ([39f0b96](https://github.com/eric-maydeck/bean-tracker/commit/39f0b962e326031479f627befc25a373130f2120))
* **insights:** tab, rank and open url params ([f3ffb18](https://github.com/eric-maydeck/bean-tracker/commit/f3ffb18d35e3e4097f0379eebcf7cb7380b9291d))

# [1.66.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.65.0...v1.66.0) (2026-10-11)


### Bug Fixes

* stats empty states use grams on hand; reset people choice at household of one ([dcb8c6a](https://github.com/eric-maydeck/bean-tracker/commit/dcb8c6a57deef14bd6fa2ba074bc317054dd66d8))


### Features

* add insights to the nav (top nav; More on phones) ([37b341a](https://github.com/eric-maydeck/bean-tracker/commit/37b341a1d8a52df62c8ed4a00c2994334ff806ec))
* household size and measured time to clear on stats ([17f594e](https://github.com/eric-maydeck/bean-tracker/commit/17f594e74942c973a89b1bc12b09da6b019516ed))
* household size editor in the sticky stats bar ([764d910](https://github.com/eric-maydeck/bean-tracker/commit/764d91013ad15e0230a7c933ff102ab15feb37ba))
* household size setting and people url param ([c9a8bfe](https://github.com/eric-maydeck/bean-tracker/commit/c9a8bfeb1aaeab11ef2fad18f5a7939dc1991b46))
* measured consumption panel on insights ([e10172d](https://github.com/eric-maydeck/bean-tracker/commit/e10172df5297e0fa0010d39e89c7c60f21d5c5e4))
* per person on insights ([55c298b](https://github.com/eric-maydeck/bean-tracker/commit/55c298ba9b91d06b15f37b3056ed394a019e56de))
* per person on stats ([dc34dfe](https://github.com/eric-maydeck/bean-tracker/commit/dc34dfe581e2a7cf28dce9af8dce6798e7c2e6de))
* sticky filter bars on insights and stats ([d515710](https://github.com/eric-maydeck/bean-tracker/commit/d5157109433c9d228377ca5cc83872ecda92dbeb))

# [1.65.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.64.0...v1.65.0) (2026-10-11)


### Bug Fixes

* insights compare tiles grow on phones instead of shrinking text ([a852434](https://github.com/eric-maydeck/bean-tracker/commit/a852434387f630dad4eb08e44e92e0833d69b7fa))
* insights dates button row and open-dialog layout state ([0036917](https://github.com/eric-maydeck/bean-tracker/commit/003691771395802455340e28458f2d9dfb2b17ab))
* insights same-length compares pace only when partly tracked ([3b6a5ae](https://github.com/eric-maydeck/bean-tracker/commit/3b6a5aedc8e3f92f365872f94839d08321557132))
* insights tiles keep captions inside; 2 columns on narrow phones ([b8bc8d9](https://github.com/eric-maydeck/bean-tracker/commit/b8bc8d9a7e08ebc5a11b840d7fe95c872acd2de2))


### Features

* insights compare against longer windows and custom ranges ([7bcee0d](https://github.com/eric-maydeck/bean-tracker/commit/7bcee0d7e41fa4568460fbf667cd0174162cc35b))
* insights compare windows and tracked-day count ([9b9edd8](https://github.com/eric-maydeck/bean-tracker/commit/9b9edd84da1fd2f464f822703e5cc4ce45b8cf89))
* insights custom range dialog, pace line and trend colours ([344f733](https://github.com/eric-maydeck/bean-tracker/commit/344f7335b55f9c21ddc594aa9d7c0ed32988c452))
* insights pace line and custom range form ([d0bf1a9](https://github.com/eric-maydeck/bean-tracker/commit/d0bf1a9464698c066ce1e107287557ff9712adf3))
* insights tile grid without empty cells; Settled → Current ([6089354](https://github.com/eric-maydeck/bean-tracker/commit/6089354d525e679ab493f2d7e0d3fbb0e2dc3f6c))
* pace insights totals across window lengths ([d76caf6](https://github.com/eric-maydeck/bean-tracker/commit/d76caf69e6467a767eefeb0bece2c9204829c7fb))

# [1.64.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.63.0...v1.64.0) (2026-10-10)


### Features

* settled/all switch on every rating tile, with tooltips ([6ceab5d](https://github.com/eric-maydeck/bean-tracker/commit/6ceab5d4c0168004d17f57d86fa6681445b74a01))

# [1.63.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.62.1...v1.63.0) (2026-10-10)


### Bug Fixes

* insights brews per day from first brew and delta polish ([fcf8f03](https://github.com/eric-maydeck/bean-tracker/commit/fcf8f03d0b5471fd0d768ec0410f5eecd09653b3))
* insights skip negative rest and years without brews ([5857fe5](https://github.com/eric-maydeck/bean-tracker/commit/5857fe5c744057942736c5cb4684bde9cb125812))
* normalize the two stray roast level labels ([e0ee91a](https://github.com/eric-maydeck/bean-tracker/commit/e0ee91a37a0d79340bc443919b4769f26a8e45b0))


### Features

* group processing labels for insights ([608c4bb](https://github.com/eric-maydeck/bean-tracker/commit/608c4bbeff3cc8cd7f0bf9abdfd1090036d855b2))
* insights brew fact derivations ([8f9062e](https://github.com/eric-maydeck/bean-tracker/commit/8f9062eb493496c16b2188a6cbe4996f7fd89b75))
* insights compare depth, metric kinds and averages ([4d6bc09](https://github.com/eric-maydeck/bean-tracker/commit/4d6bc09a84576e0d664c85750186aa3c6bccb11c))
* insights mountain time and period bounds ([5908a34](https://github.com/eric-maydeck/bean-tracker/commit/5908a343191a4b701622ca3f3398da9026480b40))
* insights overview design ([b444e14](https://github.com/eric-maydeck/bean-tracker/commit/b444e147e0c657bca04a842a5789b249452c8597))
* insights overview tiles and deltas ([4d3e24b](https://github.com/eric-maydeck/bean-tracker/commit/4d3e24bd7aca757318ea60aebcceb0142552a5e1))
* insights page with overview tiles ([21672ec](https://github.com/eric-maydeck/bean-tracker/commit/21672eca3def680765703cb956ea0a6283615b18))
* insights rating switches and adjusted means ([449df16](https://github.com/eric-maydeck/bean-tracker/commit/449df16ae9fb8275c4e5c0fa0cd5d55c952cc9b5))
* insights url state parser ([8b8e2f3](https://github.com/eric-maydeck/bean-tracker/commit/8b8e2f39326d85bceb6d933c0763a695a14e9e21))
* load per-brew and per-bag insights facts ([c6c5bb1](https://github.com/eric-maydeck/bean-tracker/commit/c6c5bb1472314ba9316a80ff48db5e2678e73974))

## [1.62.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.62.0...v1.62.1) (2026-10-10)


### Bug Fixes

* null bean conqueror brew links to missing beans, methods, mills ([32b3035](https://github.com/eric-maydeck/bean-tracker/commit/32b3035f5cce5063f090b7943f2a13b3d8701838))

# [1.62.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.61.1...v1.62.0) (2026-10-10)


### Bug Fixes

* skip bean conqueror brews with a blank uuid ([7a1239e](https://github.com/eric-maydeck/bean-tracker/commit/7a1239e7830857cb1dd8852d84bddd526ac230cf))


### Features

* derive water gh and kh from minerals ([548f513](https://github.com/eric-maydeck/bean-tracker/commit/548f513d20995055e7e2e370d6905b21c5d30880))
* import the bean conqueror zip export from stats ([e14ef5a](https://github.com/eric-maydeck/bean-tracker/commit/e14ef5a34a79eaba1534f51d98835b7b57e7fcda))
* parse the bean conqueror json export ([c4faad2](https://github.com/eric-maydeck/bean-tracker/commit/c4faad2d22088d8cae4af4e097a713726ff02609))
* read the bean conqueror export zip, including the full export ([4e3d990](https://github.com/eric-maydeck/bean-tracker/commit/4e3d9901d18c2c5bb6e8f8fcaba62a6374aae0dd))
* store bean conqueror waters and identify brews by uuid ([1609e64](https://github.com/eric-maydeck/bean-tracker/commit/1609e64e4a2e7a41e6da21637677055a3938a47b))

## [1.61.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.61.0...v1.61.1) (2026-10-10)


### Bug Fixes

* **beanconqueror:** share sets blend from the coffee name ([1cfcb70](https://github.com/eric-maydeck/bean-tracker/commit/1cfcb7018113ec38e9545ddfcaae9890a5d19548))

# [1.61.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.60.0...v1.61.0) (2026-10-09)


### Bug Fixes

* **fill:** use the variants' own price currency over the shop's base currency ([557deb4](https://github.com/eric-maydeck/bean-tracker/commit/557deb47bf3383e3e18ac17c7c3ed91475da093d))


### Features

* **subscriptions:** boot migration sets the six live subscriptions' page urls ([35a76ad](https://github.com/eric-maydeck/bean-tracker/commit/35a76add7de35114f4e2c3c3bfdd1e91dea60ac6))
* **subscriptions:** fill from page on the add form and in edit mode ([0c3ee57](https://github.com/eric-maydeck/bean-tracker/commit/0c3ee5723f18125c7a8d8d574c578307562eaf8d))
* **subscriptions:** parse subscription pages into subscription fields ([bda333a](https://github.com/eric-maydeck/bean-tracker/commit/bda333aa02067110773340cdb65600d629a098b6))

# [1.60.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.59.0...v1.60.0) (2026-10-08)


### Features

* **coffees:** card image links to the coffee page when signed in ([61f7f9d](https://github.com/eric-maydeck/bean-tracker/commit/61f7f9d65d033f482a97488c2530e67eb1dfa7a0))

# [1.59.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.58.1...v1.59.0) (2026-10-08)


### Features

* **ui:** button tiers with tonal fills and invert-on-hover ([c5cc2e8](https://github.com/eric-maydeck/bean-tracker/commit/c5cc2e80a351aa4fcf9e8585707ad6ad12981d2b))
* **ui:** top nav links grow an underline on hover ([5dc85c7](https://github.com/eric-maydeck/bean-tracker/commit/5dc85c7fc1da17bef1edf248501074ff06b7c595))

## [1.58.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.58.0...v1.58.1) (2026-10-08)


### Bug Fixes

* **coffee-page:** even button spacing; Back left, Share right on desktop ([65330d5](https://github.com/eric-maydeck/bean-tracker/commit/65330d5dbe0a7ad626e9d9a5b08255f41ea70b19))
* **images:** show the Shoebox roaster default on its labels' green, closes [#9ae197](https://github.com/eric-maydeck/bean-tracker/issues/9ae197) ([f679cb1](https://github.com/eric-maydeck/bean-tracker/commit/f679cb19d37f69c930d3daa7f9b29ecaf4d17389))

# [1.58.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.57.1...v1.58.0) (2026-10-08)


### Features

* **subscriptions:** pause/resume and a subscription page link ([6277ba9](https://github.com/eric-maydeck/bean-tracker/commit/6277ba9dbe628a09cb0fa54bb0b865a06836b398))

## [1.57.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.57.0...v1.57.1) (2026-10-08)


### Bug Fixes

* **coffees:** correct three archived coffees' name, origin and process ([d9d902d](https://github.com/eric-maydeck/bean-tracker/commit/d9d902d7e2551ea9fafa84e514eef04166d70e36))

# [1.57.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.56.0...v1.57.0) (2026-10-08)


### Features

* **coffees:** images for archived backfill leftovers, batch 2026_10_archive_b ([d6f1f4e](https://github.com/eric-maydeck/bean-tracker/commit/d6f1f4ea6e1d0eac67220226f378adb247043ca4))

# [1.56.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.55.0...v1.56.0) (2026-10-08)


### Features

* **coffees:** backfill product pages and images, batch 2026_10_archive_a ([6250209](https://github.com/eric-maydeck/bean-tracker/commit/6250209a4603eba2a47872a0dfe516182b0fa985))

# [1.55.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.54.0...v1.55.0) (2026-10-08)


### Bug Fixes

* **coffees:** guard backfill fixes by roaster too ([55d9420](https://github.com/eric-maydeck/bean-tracker/commit/55d942011f70988089b447958f8765db967dc035))


### Features

* **coffees:** backfill product pages and images, batch 2026_10_a ([1fd5129](https://github.com/eric-maydeck/bean-tracker/commit/1fd512976f749d0f9008e6e5da82185078a59336))

# [1.54.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.53.0...v1.54.0) (2026-10-07)


### Features

* **coffees:** apply guarded product page and image fixes as one batch ([69a1f69](https://github.com/eric-maydeck/bean-tracker/commit/69a1f695135ea45508802b806bb703504d52af21))
* **db:** apply product page backfill batches at boot ([9ed4c80](https://github.com/eric-maydeck/bean-tracker/commit/9ed4c8092820728a17d547ac6a6c148a6ea05113))
* **scripts:** find product pages and images for coffees without one, resumable
* **scripts:** review page and batch export for the product page backfill ([47ef3be](https://github.com/eric-maydeck/bean-tracker/commit/47ef3be93312daf754081db29a444f35a98383f3))

# [1.53.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.52.1...v1.53.0) (2026-10-07)


### Bug Fixes

* **coffees:** line up compact inline-edit icons with the form's buttons ([3c7c6e6](https://github.com/eric-maydeck/bean-tracker/commit/3c7c6e6bfb3251c767c64b81942534bfbd605633))


### Features

* **coffees:** keep several inline edit forms open at once ([8370d05](https://github.com/eric-maydeck/bean-tracker/commit/8370d0523122848399f111b459a90173e365c90a))

## [1.52.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.52.0...v1.52.1) (2026-10-07)


### Bug Fixes

* **auth:** sign in returns you to the page you were on ([3d0414d](https://github.com/eric-maydeck/bean-tracker/commit/3d0414d2cb72bef0e1cde60aa42dee3afd0a55b6))

# [1.52.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.51.0...v1.52.0) (2026-10-07)


### Bug Fixes

* **coffee-form:** image url input lines up with its row ([7326ef6](https://github.com/eric-maydeck/bean-tracker/commit/7326ef65760acef9f4341a26ad52a46cd59e9dab))
* **coffees:** a pending card keeps its action icons when another card opens ([5b3fa57](https://github.com/eric-maydeck/bean-tracker/commit/5b3fa57ea62f8e1259b2b999ca095272fdbd67ad))
* **coffees:** inline edit action row wraps inside a narrow card ([bc0f7b8](https://github.com/eric-maydeck/bean-tracker/commit/bc0f7b882d16c27ef6a83c8239a36be1febfa2b5))
* **image-suggest:** a pick never replaces a site staged by change ([f396209](https://github.com/eric-maydeck/bean-tracker/commit/f39620903d284a12bdeab0a651cb093e98684358))
* **image-suggest:** closest computed on the final list, restore per-provider page dedupe ([242f5dc](https://github.com/eric-maydeck/bean-tracker/commit/242f5dc9c0bca274d1c53c318c2dd4dda9514fd9))
* **image-suggest:** closing the dialog mid-search returns focus to suggest ([ff1847d](https://github.com/eric-maydeck/bean-tracker/commit/ff1847dc1f5143b9d590f63add754cf6e99e73b9))
* **image-suggest:** longer excerpt from the tasting notes, no smushed words ([1b818b0](https://github.com/eric-maydeck/bean-tracker/commit/1b818b024dbd93471441d179053e20b8a8a4fe43))
* **share:** share button lines up with inline-block neighbors ([929b062](https://github.com/eric-maydeck/bean-tracker/commit/929b0621712dca3e0007e6b844c50babdacc4a08))
* **share:** top-align instead of a label baseline ([4d81f25](https://github.com/eric-maydeck/bean-tracker/commit/4d81f2575e0fa06d6c0c27e20d472390675c6ed4))


### Features

* **image-suggest:** admin-only image-suggest endpoint ([90eedca](https://github.com/eric-maydeck/bean-tracker/commit/90eedca8e2831d2e2207c51f0af6856d6704e5c3))
* **image-suggest:** large image cards in the suggest dialog ([d527962](https://github.com/eric-maydeck/bean-tracker/commit/d527962d05754852449f4c8073cb2ef274d7143b))
* **image-suggest:** later providers only fill, name match ranks first ([e3c12a2](https://github.com/eric-maydeck/bean-tracker/commit/e3c12a2dc2c9c977e2f6a53cde15ef92f49a7f3d))
* **image-suggest:** provider comparison script ([c7c4810](https://github.com/eric-maydeck/bean-tracker/commit/c7c48102cf0995d1ec6f7d501dbe49f8acee956e))
* **image-suggest:** rank a page's images by bag-art hints ([5e0f39f](https://github.com/eric-maydeck/bean-tracker/commit/5e0f39f34be419652b85387db8073a6aa928d2cc))
* **image-suggest:** read every image from a product page ([b4e2a7e](https://github.com/eric-maydeck/bean-tracker/commit/b4e2a7ec6c23093e1e4089ac611f943c8b847939))
* **image-suggest:** release date, excerpt and closest-to-roast ranking ([c739e48](https://github.com/eric-maydeck/bean-tracker/commit/c739e48c83d10bea9a96c3dd3a2bec820726bee5))
* **image-suggest:** roaster_websites table with boot backfill ([5b06bbb](https://github.com/eric-maydeck/bean-tracker/commit/5b06bbbad3e417e4273a7b1988a43db034e07049))
* **image-suggest:** run providers in order and rank the pages' images ([d5389f8](https://github.com/eric-maydeck/bean-tracker/commit/d5389f84c86079c4e1a4a4f5730fb1e70c03a02c))
* **image-suggest:** save a staged roaster_website with the coffee ([9bf2513](https://github.com/eric-maydeck/bean-tracker/commit/9bf2513140cd4afa4252efc8c285fb44cd9262d6))
* **image-suggest:** shopify store search provider ([b457a78](https://github.com/eric-maydeck/bean-tracker/commit/b457a785c387e9095d56edab60604bd30aca9db8))
* **image-suggest:** show suggestions in a dialog with dates and notes ([40f915f](https://github.com/eric-maydeck/bean-tracker/commit/40f915f2f2954835a1b846cd802dcd8813974f8e))
* **image-suggest:** suggest button and pick list in the coffee form ([9b8051d](https://github.com/eric-maydeck/bean-tracker/commit/9b8051d11b283ca4cd27bbc649a7bb03459c6355))
* **image-suggest:** tavily provider with a 31-day call budget ([6f7c577](https://github.com/eric-maydeck/bean-tracker/commit/6f7c57754759c7b3ae9773726ccd1c4ce9dd3b2a))

# [1.51.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.50.0...v1.51.0) (2026-10-06)


### Features

* **coffees:** show a centered notice while Refresh reloads ([8b47cb2](https://github.com/eric-maydeck/bean-tracker/commit/8b47cb2b69fa5c98317ad595e000a030fb294d67))

# [1.50.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.49.1...v1.50.0) (2026-10-06)


### Features

* **coffees:** frozen badge and plum decaf badge ([6190230](https://github.com/eric-maydeck/bean-tracker/commit/6190230eecbfddf2a4adcb7ad491969743038234))

## [1.49.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.49.0...v1.49.1) (2026-10-06)


### Bug Fixes

* **images:** don't read a cropped wordmark as a solid background ([26f0369](https://github.com/eric-maydeck/bean-tracker/commit/26f0369573fd91aa6a8e0df9f25eccc6489499b9))
* **images:** recompute cached backdrop fills once ([e8b2238](https://github.com/eric-maydeck/bean-tracker/commit/e8b2238450b90268930abb82ff7cf5e0d2025c92))

# [1.49.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.48.0...v1.49.0) (2026-10-06)


### Bug Fixes

* **roasters:** correct dongze logo url


### Features

* **images:** background run stores local copies ([da2a72d](https://github.com/eric-maydeck/bean-tracker/commit/da2a72d444b943ad0a206b66b4dd0d27075d5a19))
* **images:** serve local copies from /img ([e854b7b](https://github.com/eric-maydeck/bean-tracker/commit/e854b7b0cd0d28f89ba576648af7481d9e0a51af))
* **images:** show local copies when available ([68e24ce](https://github.com/eric-maydeck/bean-tracker/commit/68e24ce606e50eac381d939698a61a6cdf8648e6))
* **images:** store content-addressed local copies ([1246717](https://github.com/eric-maydeck/bean-tracker/commit/12467179405f24f92123db61027cab26cd301d1f))
* **roasters:** seed macs roasters and dongze logos ([a8217d4](https://github.com/eric-maydeck/bean-tracker/commit/a8217d4b63c1f7539bb57c407a6e568c6fb68215))

# [1.48.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.47.0...v1.48.0) (2026-10-06)


### Features

* **roasters:** seed default images for existing roasters ([a265120](https://github.com/eric-maydeck/bean-tracker/commit/a265120314f9be1810e3bbb84bfb3bae5bf1a20f))

# [1.47.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.46.2...v1.47.0) (2026-10-06)


### Bug Fixes

* **beanconqueror:** treat a 0 rating as unrated ([be530a4](https://github.com/eric-maydeck/bean-tracker/commit/be530a482f94166080671406b3a7e179156d7038))


### Features

* **stats:** brews and grams per day with period averages ([508d451](https://github.com/eric-maydeck/bean-tracker/commit/508d4515f6b7d5deb0c3d76d209e4d08abdb201b))

## [1.46.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.46.1...v1.46.2) (2026-10-06)


### Bug Fixes

* **coffees:** keep the current status tab on Reset ([8275123](https://github.com/eric-maydeck/bean-tracker/commit/8275123a4fa49d2ba3bedbaae40ed65ca8836af7))

## [1.46.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.46.0...v1.46.1) (2026-10-06)


# [1.46.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.45.0...v1.46.0) (2026-10-06)


### Bug Fixes

* **coffee-form:** phone button rows share each line; phone portrait+landscape in test:ui ([a2333d0](https://github.com/eric-maydeck/bean-tracker/commit/a2333d079db3f7735a80f19b1d3d3ae1c4f4b0f0))
* **coffees:** inline-edit action row stays on one line in Cards and List like Compact ([6754143](https://github.com/eric-maydeck/bean-tracker/commit/6754143ed09920e2cb62a8094bc8194d1e6fe913))
* **coffees:** keep List inline-edit action row in the viewport, match Compact spacing ([c4ef0fa](https://github.com/eric-maydeck/bean-tracker/commit/c4ef0fa45141454cadd304900e4282cd3677477f))
* **coffees:** keep List inline-edit actions inside the table scroller ([3294208](https://github.com/eric-maydeck/bean-tracker/commit/329420888fa22d123c936df43ad1e08dd61399cd))
* **coffees:** save and cancel under the inline edit form in cards and list views ([98ea0b2](https://github.com/eric-maydeck/bean-tracker/commit/98ea0b2beeb9ebaf28d09a4adb0551a17c610e6a))
* **roaster-image:** clearing the image by typing drops the roaster-default mark ([d640330](https://github.com/eric-maydeck/bean-tracker/commit/d640330227d4155ec15976d95edde6ee517d8c3b))


### Features

* **image-fill:** contained images on their fill at every render site and in form previews ([158dbab](https://github.com/eric-maydeck/bean-tracker/commit/158dbab4c631bf4d3004823f3762d16c781e6c07))
* **image-fill:** image_fills cache, image_fill on list rows, coffeeImage returns the fill ([932856d](https://github.com/eric-maydeck/bean-tracker/commit/932856d703d7f54a3e790ac4d51f4a0e5e02a363))
* **image-fill:** image-fill endpoint and background fill worker at boot and after saves ([d72c78b](https://github.com/eric-maydeck/bean-tracker/commit/d72c78b883f389880a01a73292dd0f39a7551794))
* **image-fill:** sharp, warm-palette backdrops and the border fill algorithm ([8d96618](https://github.com/eric-maydeck/bean-tracker/commit/8d966184f5b77d5c182dc7b16e5daf48be9948d9))
* **roaster-image:** roaster_image_url on list and coffee page rows ([4795700](https://github.com/eric-maydeck/bean-tracker/commit/4795700161396bd30ab7ef43d8ff0adfacec9138))
* **roaster-image:** roaster_images table and roasterImages.ts ([f3d24dd](https://github.com/eric-maydeck/bean-tracker/commit/f3d24ddc271ef49f74160f50e77d8b81314165e2))
* **roaster-image:** save set_roaster_default with the coffee, before the dedupe ([8f5e945](https://github.com/eric-maydeck/bean-tracker/commit/8f5e9454b31977ed318bd2507d0b975bd94c05cf))
* **roaster-image:** set as roaster default button and roaster default preview ([d32437e](https://github.com/eric-maydeck/bean-tracker/commit/d32437e8ffc281e771cfd54f1aff7d7192e0f85c))
* **roaster-image:** show the roaster default when a coffee has no image ([1b96094](https://github.com/eric-maydeck/bean-tracker/commit/1b9609446e7ce6dbc27ac081f866624582a184fd))
* **roaster-image:** store null when a coffee image equals its roaster default ([03663b5](https://github.com/eric-maydeck/bean-tracker/commit/03663b5f142eb12dc3bba5c7d3c589f0d6272e0c))

# [1.45.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.44.0...v1.45.0) (2026-10-05)


# [1.44.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.43.0...v1.44.0) (2026-10-05)


### Features

* **bc:** second one-time pairs batch with guarded coffee fixes ([b6834ad](https://github.com/eric-maydeck/bean-tracker/commit/b6834ad92afac1eb2ed543c8c2961097e750988e))

# [1.43.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.42.0...v1.43.0) (2026-10-05)


### Bug Fixes

* **stats:** bag n on its own line in the link picker, wrap bean card names ([74b79a5](https://github.com/eric-maydeck/bean-tracker/commit/74b79a5afaf03301585fd1ad858fb261c446ca96))
* **stats:** roasted prefix in the link picker, added date on the twin line ([27e895a](https://github.com/eric-maydeck/bean-tracker/commit/27e895a54cf662fdb8ef0d39660e5342f26dd66c))
* **stats:** title-case status and added in the link picker meta line ([14c4cbd](https://github.com/eric-maydeck/bean-tracker/commit/14c4cbdf29e0501ad68a31e077976e699c3aa564))
* **ui:** drop the extra line break under eyebrow labels ([b38c2f3](https://github.com/eric-maydeck/bean-tracker/commit/b38c2f33149433a1eb8fa98c86ea7aac197a2091))
* **ui:** wrap long names in expanded compact rows, title-case the likely-match line ([66bd454](https://github.com/eric-maydeck/bean-tracker/commit/66bd454a75fa6467b6c3110321f1c2328f1bf58c))


### Features

* **stats:** custom link picker with search and grouped two-line options ([723951d](https://github.com/eric-maydeck/bean-tracker/commit/723951dc31c676ea704a95a11a9197e77eb54eaf))

# [1.42.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.41.0...v1.42.0) (2026-10-05)


### Bug Fixes

* **coffees:** keep the list's rest window column at its old width ([e57cce2](https://github.com/eric-maydeck/bean-tracker/commit/e57cce22a61b29ae729aa51e1154be50710882be))


### Features

* **coffees:** show grams left for open coffees with a linked bean ([a9afc00](https://github.com/eric-maydeck/bean-tracker/commit/a9afc00d33fe4f9c19ca704608e9066a84982f26))

# [1.41.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.40.0...v1.41.0) (2026-10-05)


### Features

* **beanconqueror:** apply the reconciled bean-to-coffee pairs once at boot ([6944f60](https://github.com/eric-maydeck/bean-tracker/commit/6944f60bae87e5f69f3ca6f027b1bbbf2e8a9625))

# [1.40.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.39.2...v1.40.0) (2026-10-05)


### Bug Fixes

* **coffee:** show unlink error only for a failed unlink ([95cbe72](https://github.com/eric-maydeck/bean-tracker/commit/95cbe727e5004b744daad4ce60fc8a440773adad))
* **db:** add link column, index and backfill in one transaction ([934815c](https://github.com/eric-maydeck/bean-tracker/commit/934815cf055387b3c7543549d2d8115886ffc126))
* **import:** don't auto-link a new bean when an unlinked twin exists ([49ff24c](https://github.com/eric-maydeck/bean-tracker/commit/49ff24cdfaa8991884bb37aa4f74d36620320b3c))
* **link-picker:** keep alphabetical order outside top match ([34bfd13](https://github.com/eric-maydeck/bean-tracker/commit/34bfd138fdadd36e92139b8df5f53cd3a2d5edb7))
* **link-picker:** list all twin bags under top match ([5c3a17e](https://github.com/eric-maydeck/bean-tracker/commit/5c3a17e370634e14ce5fa365ac3cdeab128d8e6b))
* **link-picker:** unique disambiguated labels across all options ([6c4cd31](https://github.com/eric-maydeck/bean-tracker/commit/6c4cd31c83e04ad8280dd31dcef47ba461c5123f))
* **ui-seed:** compare resolved paths so .. can't escape .ui-test ([5b26883](https://github.com/eric-maydeck/bean-tracker/commit/5b26883bf3613c5e26d9aa1acb66efc5624d38d3))
* **ui:** keep coffee page action labels on one line, wrap the row instead ([b94dad4](https://github.com/eric-maydeck/bean-tracker/commit/b94dad467e4bc5f5f7fb64659102841a4d053eb4))
* **ui:** keep create button at its natural width in the untracked beans table ([cc0cccd](https://github.com/eric-maydeck/bean-tracker/commit/cc0cccd553bd89cb98f232263d249bb6cdf8b17b))
* **ui:** keep quick filter switch labels on one line on phones ([9a14407](https://github.com/eric-maydeck/bean-tracker/commit/9a14407104e3edbca5a8587ba321bfa341c845de))
* **ui:** make filter chip remove button a 44px tap target on phones ([3279137](https://github.com/eric-maydeck/bean-tracker/commit/3279137809303030f0e6106737bac3de7335eaf2))
* **ui:** raise form selects to a 44px tap target on phones ([e9bbb86](https://github.com/eric-maydeck/bean-tracker/commit/e9bbb86f0cabcc4fb8a36b31611c843c884afc90))


### Features

* **beanconqueror:** link picker on stats and unlink on the coffee page ([e1697a8](https://github.com/eric-maydeck/bean-tracker/commit/e1697a81364f4cac3194850068bd8f9c5b6105e2))
* **beanconqueror:** link, unlink and create-and-link actions ([eb44618](https://github.com/eric-maydeck/bean-tracker/commit/eb446185e12f239416f4c286ad39dc6e41e7f996))
* **beanconqueror:** store bean-to-coffee links and auto-link on import ([e593b3c](https://github.com/eric-maydeck/bean-tracker/commit/e593b3c35d2c222f1ecc1bd3e2a399291e5812d1))
* **coffees:** in bean conqueror quick filter ([aa0f91b](https://github.com/eric-maydeck/bean-tracker/commit/aa0f91bc3f1259a4bff129e2b07e30ccd89b71d5))
* **link-picker:** show roaster first in option labels ([076cba9](https://github.com/eric-maydeck/bean-tracker/commit/076cba92f11efa10cf0cc30b0905895dd0795484))
* **stats:** general and bean conqueror tabs ([19b053a](https://github.com/eric-maydeck/bean-tracker/commit/19b053a78a68704f8aeaf663b29350f0953c3439))
* **ui:** top match group in link picker, BQ chip label, ui rules 14-15 ([844ae02](https://github.com/eric-maydeck/bean-tracker/commit/844ae0238208108122ceb093c8a57004a52fb48f))

## [1.39.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.39.1...v1.39.2) (2026-10-04)


### Bug Fixes

* **import:** reject workbooks that aren't bean conqueror exports ([03dffa8](https://github.com/eric-maydeck/bean-tracker/commit/03dffa84e3aad07a4104102987b97fdaca7a74e4))

## [1.39.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.39.0...v1.39.1) (2026-10-04)


### Bug Fixes

* **share:** open bean conqueror in a new tab, send roast type filter ([65f2b92](https://github.com/eric-maydeck/bean-tracker/commit/65f2b926f6058f22a09ca9b20d9bff8fdbd46442))

# [1.39.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.38.0...v1.39.0) (2026-09-28)


### Bug Fixes

* **coffees:** one row of larger compact edit icons, pending badge below ([90d9d36](https://github.com/eric-maydeck/bean-tracker/commit/90d9d3659ce1aca00147fd67ad79b16157bc6a96))


# [1.38.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.37.0...v1.38.0) (2026-09-28)


### Bug Fixes

* **share:** gate stats URL sync on load, normalise stored short-link paths ([bd8ca86](https://github.com/eric-maydeck/bean-tracker/commit/bd8ca86df2e07fb662fe8073c3787db484411f87))


### Features

* **coffees:** move the list to /coffees; / redirects ([1ccbd5e](https://github.com/eric-maydeck/bean-tracker/commit/1ccbd5e2ca7fbbe57cc00c4fd9b3c4c26f592e36))
* **coffees:** url codec and 12h persistence for coffee view state ([6b05a3b](https://github.com/eric-maydeck/bean-tracker/commit/6b05a3b11f3d4c9d08d9f89528a44ae48caf84ee))
* **coffees:** view state in the URL, 12h memory, Share button ([ae625d3](https://github.com/eric-maydeck/bean-tracker/commit/ae625d3edafb214c251cc59526cd758273a79de1))
* **share:** public short links with TTL and row cap ([f3931dc](https://github.com/eric-maydeck/bean-tracker/commit/f3931dccb2e417154bfd3b758fd08fac060aaa2e))
* **url-state:** remembered-choice and whitelisted param helpers ([ac20d6b](https://github.com/eric-maydeck/bean-tracker/commit/ac20d6bec19f97e0618862cf320591fb0b0f4284))
* **url-state:** shareable stats, on-deck and subscriptions views ([f5a1ed9](https://github.com/eric-maydeck/bean-tracker/commit/f5a1ed9e7823232afc5eea151b55b4fbe8a51731))

# [1.37.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.36.0...v1.37.0) (2026-09-26)


### Features

* **coffees:** show date added and last updated on the coffee page ([525a1ec](https://github.com/eric-maydeck/bean-tracker/commit/525a1ec26939d1a574a1562edf2f5c343dbd7ea1))

# [1.36.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.35.0...v1.36.0) (2026-09-26)


### Features

* **nav:** use Phosphor icons for navigation; rename "Log out" to "Sign out" ([e2df329](https://github.com/eric-maydeck/bean-tracker/commit/e2df329539774d954d72fa6e5be5ed7a44a59981))

# [1.35.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.34.1...v1.35.0) (2026-09-26)


### Features

* **coffees:** compact row links to its page; back re-expands it ([e6a9fbc](https://github.com/eric-maydeck/bean-tracker/commit/e6a9fbc65374b4609e30c33e6e74de8918119a20))

## [1.34.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.34.0...v1.34.1) (2026-09-26)


### Bug Fixes

* **coffees:** row Edit opens only that coffee, with its own save ([a951e80](https://github.com/eric-maydeck/bean-tracker/commit/a951e807f31553bce4028dca4412c8c523bf96db))

# [1.34.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.33.1...v1.34.0) (2026-09-26)


### Bug Fixes

* **db,form:** enforce foreign_keys pragma and disambiguate slug button labels ([c1281ff](https://github.com/eric-maydeck/bean-tracker/commit/c1281ff2014dcec4d354d422c8f3b487320c7781))
* **detail:** equal-size action buttons, spacing, and drop duplicate Clone ([42d16df](https://github.com/eric-maydeck/bean-tracker/commit/42d16df42e05734f5b7dc558d9825ed6a8f74732))
* **detail:** hide the redundant update button on the coffee page ([a528b36](https://github.com/eric-maydeck/bean-tracker/commit/a528b362bc771546c888c91f25b8ba5a7973fde6))
* **fill:** block NAT64 local-use and Teredo IPv6 ranges ([189d74a](https://github.com/eric-maydeck/bean-tracker/commit/189d74a61a2be57d3968d31e08e6639f14032658))
* **fill:** drop zero-price Shopify variants and guard malformed meta.json ([93ccabc](https://github.com/eric-maydeck/bean-tracker/commit/93ccabc84d966789b3eced862f103df52f2fcf4a))
* **fill:** match roast levels regardless of hyphen/space/case ([9cf079f](https://github.com/eric-maydeck/bean-tracker/commit/9cf079f1b6676e615721462854450988df1e27e3))
* **fill:** prefer the page's own weight over shopify's grams (shipping weight) ([259ce30](https://github.com/eric-maydeck/bean-tracker/commit/259ce30f6eab07847940918be83732f8e455247c))
* **fill:** resolve relative and protocol-relative image URLs ([38b7412](https://github.com/eric-maydeck/bean-tracker/commit/38b74121347bdc9ed82e072aa59891bb63973589))
* **fill:** restore the timeout-specific 504 branch in fill-from-url ([5fd1395](https://github.com/eric-maydeck/bean-tracker/commit/5fd1395369fbd93b8cf5d0fe95adee76222e0e03))
* **fill:** reword rest-day suggestion note to the requested phrasing ([50b57c0](https://github.com/eric-maydeck/bean-tracker/commit/50b57c0fc6e638e52e0886626cfbacbc4eac07a7))
* **fill:** strip a trailing roaster/site-name suffix from coffee_name ([65a586f](https://github.com/eric-maydeck/bean-tracker/commit/65a586f4bad33d87516b4218a9d4e6fc95a9f440))
* **fill:** tighten IPv6 blocklist and destroy decompression stream on 2MB cap ([c009c07](https://github.com/eric-maydeck/bean-tracker/commit/c009c07b15e03d2a53c9561dcc420aff5ebac0de))
* **fill:** use shopify's own variant grams when the label has no weight ([21d65a3](https://github.com/eric-maydeck/bean-tracker/commit/21d65a331bfd7879c769a1333ce69c86df107187))
* **form:** align the decaf checkbox with the neighbouring inputs ([59dc1c4](https://github.com/eric-maydeck/bean-tracker/commit/59dc1c4c730cf8b7e84b70790ac3c13ca71d6aa1))
* **form:** clear a stale rest suggestion when a fill sets roast level alone ([e15e4df](https://github.com/eric-maydeck/bean-tracker/commit/e15e4dfd2d3b9c1a7d70e2bf092d906eaaa7bbbc))
* **form:** don't let save-changes' apply-open-form step fight a staged delete ([4a72018](https://github.com/eric-maydeck/bean-tracker/commit/4a72018a67c8b15f7ae2ec597f6f8d4f0449a89e))
* **form:** equal columns, image url beside the rest fields, decaf under frozen end ([4e106b6](https://github.com/eric-maydeck/bean-tracker/commit/4e106b61e45cc66fd4bd1f4f4636f71f5bab4002))
* **form:** image row layout, code-style URL, locked slug, rest note, save changes ([b50ac64](https://github.com/eric-maydeck/bean-tracker/commit/b50ac644e330114935da0ebc1c5c48bf0609e49c))
* **form:** keep other columns fixed when the image preview grows ([dda39c0](https://github.com/eric-maydeck/bean-tracker/commit/dda39c088d32fc0b5e96c47bf9bb1ef79346ddbe))
* **form:** keep the decaf checkbox pinned to the top of its grid row ([45a9d8c](https://github.com/eric-maydeck/bean-tracker/commit/45a9d8c80f9d17858c2022b61b3fc75d1d21b6d6))
* **form:** move decaf under frozen end date and the url slug under decaf ([7180c91](https://github.com/eric-maydeck/bean-tracker/commit/7180c9137161ccc6409d57809491edf69cc04b68))
* **form:** put the rest fields under roast date on phones ([8bbc84f](https://github.com/eric-maydeck/bean-tracker/commit/8bbc84f77dcfea43d2611578321fd1b5ece81250))
* **form:** put the url slug under the image block on desktop ([a1db9d7](https://github.com/eric-maydeck/bean-tracker/commit/a1db9d76b01e25b281ea427a046575a79bc2cc19))
* **form:** reorder mobile rest/decaf and stack fill-anyway yes/no below text ([4650455](https://github.com/eric-maydeck/bean-tracker/commit/465045593084d1552cf8fab97face0bf4633cf6d))
* **form:** shorten rest-day labels so they fit on one line ([302ff6d](https://github.com/eric-maydeck/bean-tracker/commit/302ff6d119579ec34fad0b5d1eabe14e8c0081cf))
* **form:** show the rest suggestion directly below the rest fields ([e798fbd](https://github.com/eric-maydeck/bean-tracker/commit/e798fbd3f92cef7ece346d0f22130880d2b65561))
* **form:** stack decaf, rest days, and frozen dates under their related fields ([f92beb9](https://github.com/eric-maydeck/bean-tracker/commit/f92beb90b30646933900c06557c0ae8cccb8c0c4))
* **types:** clear svelte-check errors introduced by product_url ([b0a5cf1](https://github.com/eric-maydeck/bean-tracker/commit/b0a5cf1213241ab4ace23b66819b976f5a3c9e3b))


### Features

* **coffees:** add product_url field, saved on every path and linked from the detail page ([db71743](https://github.com/eric-maydeck/bean-tracker/commit/db71743b8a42a16934247faf30d5b558e2ba1413))
* **coffees:** lock the slug field by default with an edit/cancel toggle ([7be6c9a](https://github.com/eric-maydeck/bean-tracker/commit/7be6c9abf0fb2619423dd2e0f385f5285ed9fea1))
* **coffees:** regenerate the slug on identity edits and redirect old slugs ([adcdeb2](https://github.com/eric-maydeck/bean-tracker/commit/adcdeb25a60c3fc17f6b29bde48d1fe47d7f0b81))
* **fill:** add a guarded server-side fetch for product pages ([5bd2bb4](https://github.com/eric-maydeck/bean-tracker/commit/5bd2bb4a8e53b03fb8bf65612774f41f8df618bc))
* **fill:** add admin endpoint that fills coffee fields from a product URL ([ac296a5](https://github.com/eric-maydeck/bean-tracker/commit/ac296a5a3f230e0efc62f57cd5b1648ea26b4964))
* **fill:** convert non-USD prices with cached daily rates from open.er-api.com ([f3f3572](https://github.com/eric-maydeck/bean-tracker/commit/f3f357225380e41e1dab1018bdc475599d5f0ac6))
* **fill:** extract coffee name, origin, processing and bag size from product data ([b3a2636](https://github.com/eric-maydeck/bean-tracker/commit/b3a26361af94df455f09dc4aa8a22de90e5b1baa))
* **fill:** fill from page button, status note, size chips and discard image in the coffee form ([fe7b42f](https://github.com/eric-maydeck/bean-tracker/commit/fe7b42f969e07af7003c1f05b5b177fe82cd0c8b))
* **fill:** image preview and revert the product URL after a failed fill ([f5b3312](https://github.com/eric-maydeck/bean-tracker/commit/f5b33121abbf6e10077d692638e401ce71cc6ea4))
* **fill:** match roaster, roast level and bag size against the user's history ([756cae2](https://github.com/eric-maydeck/bean-tracker/commit/756cae20c7fc078711f65741ee90d1afb6f2c2e7))
* **fill:** parse Shopify JSON and product HTML into one shape, with captured fixtures ([a9f123e](https://github.com/eric-maydeck/bean-tracker/commit/a9f123ec6007c4c29f1778be211181a25e94c1ce))
* **fill:** suggest rest days from history or roast-level defaults ([d4e9f03](https://github.com/eric-maydeck/bean-tracker/commit/d4e9f037083c411dab646a601b578833aaa36512))

## [1.33.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.33.0...v1.33.1) (2026-09-25)


### Bug Fixes

* **auth:** decay the login rate-limiter's failure count over time ([95118c0](https://github.com/eric-maydeck/bean-tracker/commit/95118c0f8d7862c7da99733a8cc646b5f8495214))
* **beanconqueror:** validate blend component column headers on import ([48a2fcc](https://github.com/eric-maydeck/bean-tracker/commit/48a2fcc7ed5e40bb4d510ab1a2480f9480427b1d))
* **stats:** apply the unmatched-beans limit and count in SQL, not client-side ([a7537b7](https://github.com/eric-maydeck/bean-tracker/commit/a7537b7fbfd7d0ed8df8f8f279e3bb0bc7b7ff71))
* **stats:** clarify the beanConqueror rated-group empty-state copy ([8d3a267](https://github.com/eric-maydeck/bean-tracker/commit/8d3a2676ca664fda9b751350af12875293f60267))

# [1.33.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.32.1...v1.33.0) (2026-09-25)


### Bug Fixes

* **coffees:** more space between search and toolbar buttons on phones ([4b0b7db](https://github.com/eric-maydeck/bean-tracker/commit/4b0b7db631d862d9e15f673319af63c5ed89ce69))
* **coffees:** put Refresh before Reset; full-width search on phones ([d5b05bf](https://github.com/eric-maydeck/bean-tracker/commit/d5b05bf1ab5041d28118e3b94c0022de42637f63))
* **filters:** even column grid and wider desktop filter menu ([e6395f6](https://github.com/eric-maydeck/bean-tracker/commit/e6395f674ac3f136569b5136121e5646a3f03033))
* **filters:** match quick-filter segment spacing to the column buttons ([df9eaa1](https://github.com/eric-maydeck/bean-tracker/commit/df9eaa1f03f84805d7e922e008ae84770a3752b9))
* **filters:** same even column grid for the filter menu on phones ([cc81b48](https://github.com/eric-maydeck/bean-tracker/commit/cc81b4856189db76dc549238252ea4cde0c7036a))


### Features

* **filters:** turn Decaf/Frozen into quick-filter switches ([0e48fd0](https://github.com/eric-maydeck/bean-tracker/commit/0e48fd04c35b983127775b6a6f1a711db552435e))

## [1.32.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.32.0...v1.32.1) (2026-09-25)


### Bug Fixes

* **filters:** add aria-modal and a focus trap to the filter editor ([5d70c87](https://github.com/eric-maydeck/bean-tracker/commit/5d70c87df260c3700acd64491926703ab5abcc0c))
* **filters:** lock page scroll behind the mobile filter bottom sheet ([9e87f6b](https://github.com/eric-maydeck/bean-tracker/commit/9e87f6b0c6be20b496e73e06dad3aab3da81f62e))
* **filters:** re-stamp lastUsed when leaving the Coffees page ([0fd1e3e](https://github.com/eric-maydeck/bean-tracker/commit/0fd1e3e5d430f5e9d6d6b06972c12b3af23152bc))

# [1.32.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.31.0...v1.32.0) (2026-09-25)


### Bug Fixes

* **filters:** drop saved filters whose mode does not fit their column ([0b43375](https://github.com/eric-maydeck/bean-tracker/commit/0b43375097c7e7e0033132aaa525ad617b269fa2))
* **filters:** format chip values instead of showing the raw typed text ([774e990](https://github.com/eric-maydeck/bean-tracker/commit/774e9903cdbaedbbf405ef61e3cdd1fc2cd32a3c))
* **filters:** give filter-value rows a 44px tap target on mobile ([582b0c7](https://github.com/eric-maydeck/bean-tracker/commit/582b0c78476fe1b944a009c6beb52c07788c0271))
* **filters:** keep chip filter editor within the viewport ([b5272a0](https://github.com/eric-maydeck/bean-tracker/commit/b5272a0529bd3ebd7e87150d3ced8f42362dd771))
* **filters:** keep the chip's visible text as its accessible name ([4719085](https://github.com/eric-maydeck/bean-tracker/commit/4719085267a355368778fab6186f1b40d74e2613))
* **filters:** label Weight column as "Weight (g)" in the filter editor ([45c7bdb](https://github.com/eric-maydeck/bean-tracker/commit/45c7bdb15ad52442c0dac5a981ca9c813fda4f73))
* **filters:** manage focus on filter editor open/close ([053c7b1](https://github.com/eric-maydeck/bean-tracker/commit/053c7b1e5d434b6989520edc1428c0de2a5eb2e8))
* **filters:** return focus to "+ Filter" when Clear ends that flow ([6a9e676](https://github.com/eric-maydeck/bean-tracker/commit/6a9e6762a956169439c7cada97a15bd7bfd2c035))


### Features

* **filters:** add coffee filter model and applyFilters ([b3f225a](https://github.com/eric-maydeck/bean-tracker/commit/b3f225a34277737f157902feb9d9aa4527207b73))
* **filters:** add FilterBar and FilterEditor components ([c114448](https://github.com/eric-maydeck/bean-tracker/commit/c114448fa58cd56b71128d4849997e0d918ae4a8))
* **filters:** add value counts, apply gating, and chip text ([d7b1650](https://github.com/eric-maydeck/bean-tracker/commit/d7b165018dc2f3877bb928d95accde174fc15dd1))
* **filters:** back to collection restores list position via history ([6aaeae7](https://github.com/eric-maydeck/bean-tracker/commit/6aaeae7c9c2abdff728d8d4dd1eebdf3438cca7e))
* **filters:** persist filters and search with version and 12h expiry ([6c60def](https://github.com/eric-maydeck/bean-tracker/commit/6c60deffdd1b6828c7a89950439fef308e557df0))
* **filters:** replace Decaf/Frozen rows with filter chips on Coffees page ([0c5c13e](https://github.com/eric-maydeck/bean-tracker/commit/0c5c13ed6e52050655063f5a4eb180e72f797c10))

# [1.31.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.30.0...v1.31.0) (2026-09-24)


### Bug Fixes

* **login:** drop Secure session cookie flag on the local dev server ([79d78a6](https://github.com/eric-maydeck/bean-tracker/commit/79d78a6a9f135c8ae53b20822eb725f03d8fc328))


### Features

* **coffees:** clone a coffee; add/edit/clone always available when logged in ([24851ef](https://github.com/eric-maydeck/bean-tracker/commit/24851efa6e76e2086708cc5a4bed51ba7ea2a0f3))

# [1.30.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.29.0...v1.30.0) (2026-09-24)


### Features

* **stats:** uniform tile grid, container-scaled tiles, 8-tile At a Glance ([aa89ecf](https://github.com/eric-maydeck/bean-tracker/commit/aa89ecfd29e8f00fa8f41b9730572e27b8236143))

# [1.29.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.28.2...v1.29.0) (2026-09-23)


### Features

* **stats:** filter Top Coffees by Category by status ([c28f28f](https://github.com/eric-maydeck/bean-tracker/commit/c28f28f2379250b97981008bd5fbb370b74048e9))
* **stats:** keep Top Coffees axis fixed across status toggles ([6f67296](https://github.com/eric-maydeck/bean-tracker/commit/6f672967ff2d0975e80741ecce6b20aba9275c88))

## [1.28.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.28.1...v1.28.2) (2026-09-23)


### Bug Fixes

* harden release pipeline against the workflow_run stale-ref race ([57a4778](https://github.com/eric-maydeck/bean-tracker/commit/57a4778c98d05ad3f55f8481890d8512449c7d74))

## [1.28.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.28.0...v1.28.1) (2026-09-23)


### Bug Fixes

* vertically align the QR hint text with the button next to it ([2fd5d0e](https://github.com/eric-maydeck/bean-tracker/commit/2fd5d0ed0716b7c707e31f1fb415f6ce3a1a0b62))

# [1.28.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.5...v1.28.0) (2026-09-23)


### Bug Fixes

* roast_range floor + redesign the Bean Conqueror share panel ([e54d157](https://github.com/eric-maydeck/bean-tracker/commit/e54d1579e423e8d9d0d5b07880f79a052305904f))


### Features

* highlight the exact roast level and cost after a Bean Conqueror import ([41406a8](https://github.com/eric-maydeck/bean-tracker/commit/41406a8a0c46ed1a1d55c29f0d042282b4633057))

## [1.27.5](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.4...v1.27.5) (2026-09-23)


### Bug Fixes

* stack By Method/By Grinder charts on mobile, not just donuts ([91d0c5e](https://github.com/eric-maydeck/bean-tracker/commit/91d0c5ed14e6aa84dc43587ec03077de0bd6a03e))

## [1.27.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.3...v1.27.4) (2026-09-23)

Manual patch release.

## [1.27.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.2...v1.27.3) (2026-09-23)


### Bug Fixes

* left-align top tile groups and widen Bean Conqueror panel to full width ([9cb520e](https://github.com/eric-maydeck/bean-tracker/commit/9cb520ea8906e837093fdb5a12f0cd941872227a))

## [1.27.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.1...v1.27.2) (2026-09-23)


### Bug Fixes

* revert possible-match line-break/parens change on mobile, keep desktop ([d63bf06](https://github.com/eric-maydeck/bean-tracker/commit/d63bf061771b5fb40fa820388b04efd8358fdeda))

## [1.27.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.27.0...v1.27.1) (2026-09-23)


### Bug Fixes

* move possible-match roast date/status to its own line, drop parens ([335a8d8](https://github.com/eric-maydeck/bean-tracker/commit/335a8d8df3feb7b43569a5246dcbf6d87e56afcc))

# [1.27.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.4...v1.27.0) (2026-09-23)


### Features

* flag likely BeanConqueror duplicate matches for human confirmation ([519c132](https://github.com/eric-maydeck/bean-tracker/commit/519c132632e6b620b46921954fa9334e98f0e5d9))

## [1.26.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.3...v1.26.4) (2026-09-23)


### Bug Fixes

* chart-panel line chart colliding with tiles above it ([a767ba5](https://github.com/eric-maydeck/bean-tracker/commit/a767ba5dc3c010fa81cd5840e16eb6491fe18f77))

## [1.26.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.2...v1.26.3) (2026-09-23)


### Bug Fixes

* disable mobile browser auto text-size-adjust (real page-wide overflow) ([767afae](https://github.com/eric-maydeck/bean-tracker/commit/767afaef6db8d137f2cc0478f7ebe1bd582df358))

## [1.26.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.1...v1.26.2) (2026-09-23)


### Bug Fixes

* mobile stats — font proportion, overflow, and button sizing bugs ([a33da26](https://github.com/eric-maydeck/bean-tracker/commit/a33da261376b9c6aa879bd7918d912828e6d6764))

## [1.26.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.26.0...v1.26.1) (2026-09-23)


### Bug Fixes

* mobile stats tile/font proportion and donut cascade bug ([094e25c](https://github.com/eric-maydeck/bean-tracker/commit/094e25c6f8b42d12a3fb1dc4890a5856dd7bff20))

# [1.26.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.25.2...v1.26.0) (2026-09-23)

Bean Conqueror import fixes (413 error, ratings chart aggregation) and a /stats mobile layout redesign. Semantic-release couldn't auto-cut this one due to a workflow_run race condition against a docs-only follow-up commit.

## [1.25.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.25.1...v1.25.2) (2026-09-23)


### Bug Fixes

* aggregate Bean Conqueror ratings-over-time chart by week ([d814385](https://github.com/eric-maydeck/bean-tracker/commit/d814385ff3a07ea5b9a84f97c40a89da95cd9db9))

## [1.25.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.25.0...v1.25.1) (2026-09-23)


### Bug Fixes

* raise BODY_SIZE_LIMIT so Bean Conqueror imports don't 413

# [1.25.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.24.2...v1.25.0) (2026-09-23)


### Features

* add admin-gated mark-read/dismiss routes for alerts ([452d969](https://github.com/eric-maydeck/bean-tracker/commit/452d96925265ee80cd7661891106e32affe87378))
* add admin-only alerts bell and panel to the nav ([a486644](https://github.com/eric-maydeck/bean-tracker/commit/a4866449e4afe5226f89b3983cdfb7020c51f7a7))
* add alerts data layer for operational failure notifications ([196484c](https://github.com/eric-maydeck/bean-tracker/commit/196484cc34c6907f63eb72e9e299196e261efc9c))

## [1.24.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.24.1...v1.24.2) (2026-09-22)


### Bug Fixes

* center stats tile subtext symmetrically between value and label ([d564ca8](https://github.com/eric-maydeck/bean-tracker/commit/d564ca884f6dfe3dd97180295c009b623b03232e))

## [1.24.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.24.0...v1.24.1) (2026-09-22)


### Bug Fixes

* harden stats rates handling and close two staged-edit gaps ([2ad669f](https://github.com/eric-maydeck/bean-tracker/commit/2ad669fdade58ea883d54ca15e4e4612067c9982))

# [1.24.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.23.0...v1.24.0) (2026-09-22)


### Features

* redesign stats page tiles with static sizing and overflow-safe formatting ([858b538](https://github.com/eric-maydeck/bean-tracker/commit/858b53895048fe742c644c11e005a9b3bf17708d))

# [1.23.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.22.1...v1.23.0) (2026-09-22)


### Features

* add per-page titles and a coffee-cup favicon ([2ef362b](https://github.com/eric-maydeck/bean-tracker/commit/2ef362b0885513f2e7ca726754f48b3126f11ecb))

## [1.22.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.22.0...v1.22.1) (2026-09-22)


### Bug Fixes

* correct remaining wire-type mismatches in beanconquerorBean.proto ([6b74f42](https://github.com/eric-maydeck/bean-tracker/commit/6b74f42daf81471fdc44bd0a6ef3905146238eae))

# [1.22.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.21.0...v1.22.0) (2026-09-22)


### Bug Fixes

* exclude unrated-only groups from Bean Conqueror RatedGroup breakdowns ([7daaeb5](https://github.com/eric-maydeck/bean-tracker/commit/7daaeb53b0e38429cd2780e00941ff5363a8124e))
* match Bean Conqueror's shipped proto wire types for weight/cost ([790ab99](https://github.com/eric-maydeck/bean-tracker/commit/790ab990c55d71803eead9f7d79596d853cfca13))
* parse slash-formatted date/timestamp strings from Bean Conqueror xlsx exports ([cee9651](https://github.com/eric-maydeck/bean-tracker/commit/cee965187c62d8dd6602ab5a685471987052e733))
* rename Bean Conqueror share button to "Import into Bean Conqueror" ([b6948d5](https://github.com/eric-maydeck/bean-tracker/commit/b6948d5f51eb20de4134bc259b611cb9083a7e26))
* require a minimum brew count for rated Bean Conqueror groups ([707b43d](https://github.com/eric-maydeck/bean-tracker/commit/707b43d16d8ee6e234870d35695626947ce1753d))
* use expression-based unique index for beanconqueror_brews identity instead of trigger ([e52e9cb](https://github.com/eric-maydeck/bean-tracker/commit/e52e9cbd39d0cc04860d941d19afe9e43332e257))
* validate export headers and tidy the candidate list ([282d03e](https://github.com/eric-maydeck/bean-tracker/commit/282d03ec51fe8e7ce7f0ef0ace74888b00c678a5))


### Features

* add Bean Conqueror candidate list, Dismiss, and create-coffee modal ([fc23fe7](https://github.com/eric-maydeck/bean-tracker/commit/fc23fe758bd69e1bf26e3274a0a75accb0bdbe30))
* add Bean Conqueror data model and shared Excel parsing helpers ([4a5da18](https://github.com/eric-maydeck/bean-tracker/commit/4a5da18c85280e695304ddf1cac98043226757d2))
* add Bean Conqueror stats and breakdowns tabs ([1942b9d](https://github.com/eric-maydeck/bean-tracker/commit/1942b9da53cf0412942c19482403bf6c27382472))
* add Bean Conqueror xlsx import action and upload UI ([899664b](https://github.com/eric-maydeck/bean-tracker/commit/899664b381dda9aee9b0b26dcd1bfe01b80ba04e))
* add Bean Conqueror xlsx parsing and diff/upsert import ([288a860](https://github.com/eric-maydeck/bean-tracker/commit/288a860f93164865bfc57f1676ccd67c25dfd323))
* add Send to Bean Conqueror QR/link share button ([9d7fb04](https://github.com/eric-maydeck/bean-tracker/commit/9d7fb04059ad3c8cea1da1fab770e3da0e7ed219))


### Performance Improvements

* load protobufjs and qrcode only when sharing a coffee ([fc27f47](https://github.com/eric-maydeck/bean-tracker/commit/fc27f47e5b3038f12264568586b8fcae725e0ce0))

# [1.21.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.20.2...v1.21.0) (2026-09-22)


### Features

* add visible-list totals and decaf/frozen filters to the Coffees page ([77e53f9](https://github.com/eric-maydeck/bean-tracker/commit/77e53f94b589947bc1181b91ad0aa9776a76daba))

## [1.20.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.20.1...v1.20.2) (2026-09-22)


### Bug Fixes

* eliminate NaN day counts, equalize panel/tile heights, polish layout ([d14a1e5](https://github.com/eric-maydeck/bean-tracker/commit/d14a1e57404fffba09b44ef57d19ee647403ccbb))

## [1.20.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.20.0...v1.20.1) (2026-09-22)


### Bug Fixes

* stabilize composition chart width, add donut percentages, rename headings ([a86c833](https://github.com/eric-maydeck/bean-tracker/commit/a86c83322dff091ba8087fd3b658d7b7c5194e28))

# [1.20.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.19.0...v1.20.0) (2026-09-22)


### Features

* expand stats page timing/rate detail and improve chart readability ([79bab04](https://github.com/eric-maydeck/bean-tracker/commit/79bab04376e5a944f69eca7b4306dad644052f70))

# [1.19.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.18.0...v1.19.0) (2026-09-22)


### Features

* group stats page sections into labeled panels ([b69f917](https://github.com/eric-maydeck/bean-tracker/commit/b69f91706b8d3d9c83230a83d10ee8158aba6dd3))

# [1.18.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.17.0...v1.18.0) (2026-09-22)


### Bug Fixes

* left-align sparse stat rows, center each tile's own content ([8107567](https://github.com/eric-maydeck/bean-tracker/commit/8107567312b9036a5a2e939e21b4ef7ad64eaf76))


### Features

* add finished-coffee stats, second donut, and composition chart fixes ([39dde01](https://github.com/eric-maydeck/bean-tracker/commit/39dde013a26618d6c530c140a6e99dd8bb2760a9))

# [1.17.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.16.0...v1.17.0) (2026-09-22)


### Bug Fixes

* disambiguate stat labels, pin locale, and guard the donut against an empty backlog ([8309dc0](https://github.com/eric-maydeck/bean-tracker/commit/8309dc0525c8c27fcfb0f0a46ff3e68a29e824a8))
* keep the stats rate-edit form open so save errors are visible ([602a32f](https://github.com/eric-maydeck/bean-tracker/commit/602a32faf64b5f1c30b072be1887925fcfb3fb0a))


### Features

* add /stats route load, rate-update action, and nav link ([d53adf9](https://github.com/eric-maydeck/bean-tracker/commit/d53adf9bcbff5f78168ebf0c60e397a79085803a))
* add Chart.js and a theme-aware reusable chart component ([506ca2a](https://github.com/eric-maydeck/bean-tracker/commit/506ca2a1c1e0d58dbf7b36fe742474b7826e2c42))
* add editable stats consumption-rate settings to app_meta ([73fa47a](https://github.com/eric-maydeck/bean-tracker/commit/73fa47acbe13d40489f85f3f67be9204679cbe26))
* add pure backlog-stats computation module ([00d33d0](https://github.com/eric-maydeck/bean-tracker/commit/00d33d0933b68a0c611d85eae1a75813b7e12719))
* build the backlog stats page UI ([961483f](https://github.com/eric-maydeck/bean-tracker/commit/961483f129b9101f36a427014a6438e323823cab))

# [1.16.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.15.0...v1.16.0) (2026-09-21)


### Features

* add a 'Stay signed in' checkbox for 30-day remembered sessions ([314303f](https://github.com/eric-maydeck/bean-tracker/commit/314303fda60a2e5bac04c20c5175565e641cb418))
* show 10 coffees on the On Deck next-up list instead of 5 ([ed3e70f](https://github.com/eric-maydeck/bean-tracker/commit/ed3e70f3d21e4144a61ceaf607a578231f8befce))

# [1.15.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.14.1...v1.15.0) (2026-09-21)


### Bug Fixes

* correctly display staged Decaf checkbox edits on reopen ([a7804de](https://github.com/eric-maydeck/bean-tracker/commit/a7804de1dfef1d03b16db7ebb05cef7924b2143e))
* harden batch actions with a default case and request-body validation ([059bc49](https://github.com/eric-maydeck/bean-tracker/commit/059bc49a9d369548002dc663e7555dbefe17119b))
* harden saveChanges error handling and guard Discard during save ([ae17f11](https://github.com/eric-maydeck/bean-tracker/commit/ae17f11fd6b69e58ad204ae1b0678e159d8204ea))
* staged-edit un-stage affordance, stale form data, and save-flow error handling ([0cc3ca1](https://github.com/eric-maydeck/bean-tracker/commit/0cc3ca174202bcaf7a846b1a27ac50d8b457ec20))


### Features

* add atomic batch validate/commit actions for coffees ([2a46657](https://github.com/eric-maydeck/bean-tracker/commit/2a4665737bf40e3583bd9392742a5c1818a04adb))
* add atomic batch validate/commit actions for subscriptions ([ad4641f](https://github.com/eric-maydeck/bean-tracker/commit/ad4641f3a4058c22574b3efe8eab7cdb5531ee1e))
* add batch validate/commit API routes for coffees and subscriptions ([fa395cf](https://github.com/eric-maydeck/bean-tracker/commit/fa395cf839458b5fcef9230fd1a8c7973b8a8e3e))
* add shared pending-changes module for staged edit sessions ([38c9373](https://github.com/eric-maydeck/bean-tracker/commit/38c9373dc08be97c292eeaaa76a0d1281785d0f9))
* add staged-mode support to CoffeeForm and a button-success style ([892c36d](https://github.com/eric-maydeck/bean-tracker/commit/892c36d683140b5917f4ea1e6a03fc3b2b6ac58a))
* convert coffee detail page to a staged Save changes / Discard changes session ([caa54a2](https://github.com/eric-maydeck/bean-tracker/commit/caa54a2d443872c0313d04e9f1646d4b7a3e8001))
* convert Coffees page to a staged Save changes / Discard changes session ([8227b89](https://github.com/eric-maydeck/bean-tracker/commit/8227b8922dfae07a157cb522f68328c290c935c2))
* convert Subscriptions page to a staged Save changes / Discard changes session ([8d736b6](https://github.com/eric-maydeck/bean-tracker/commit/8d736b6a840576b94b089b5a670ae5ab14a93b29))

## [1.14.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.14.0...v1.14.1) (2026-09-20)


### Bug Fixes

* extend the decaf backfill to also check processing, not just name ([45079b5](https://github.com/eric-maydeck/bean-tracker/commit/45079b51d634c65ccd75488e042e3a46deece9c3))
* move status/decaf badges inline next to the coffee name ([e6c4cc1](https://github.com/eric-maydeck/bean-tracker/commit/e6c4cc1ecb5ccc7250e1f255d29603fcfb9f1f26))

# [1.14.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.13.0...v1.14.0) (2026-09-20)


# [1.13.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.12.1...v1.13.0) (2026-09-19)

**New:** Manual release workflow — trigger a patch/minor/major release on demand from GitHub Actions instead of relying solely on commit-message conventions.

**Polish:** Roast-level bean icons on the Coffees page now render brown (light mode) / tan (dark mode) to match the coffee theme, instead of plain black/white.

## [1.12.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.12.0...v1.12.1) (2026-09-19)


### Bug Fixes

* address 6 deferred mobile-responsive polish items ([1a07e00](https://github.com/eric-maydeck/bean-tracker/commit/1a07e005799d15941db9acfbb7a994f488bab4ac))

# [1.12.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.11.0...v1.12.0) (2026-09-19)


### Bug Fixes

* address final-review findings on mobile-responsive plan ([a0aaa17](https://github.com/eric-maydeck/bean-tracker/commit/a0aaa17e7713b47b82d8d03ef288b6f104f04b54))
* bump mobile input font-size and touch targets to avoid iOS zoom and cramped taps ([e80b882](https://github.com/eric-maydeck/bean-tracker/commit/e80b882a0a285decbd28e55e41a90ca61918e456))
* coffees table view scrolls horizontally instead of squeezing columns under 640px ([b98f912](https://github.com/eric-maydeck/bean-tracker/commit/b98f9123fd6f4b0723728e558d7108a4063f2054))
* subscriptions table view scrolls horizontally instead of squeezing columns under 640px ([d9681ad](https://github.com/eric-maydeck/bean-tracker/commit/d9681adaf427223b346d9b090f47f56215ff30fb))


### Features

* add bottom tab bar navigation for mobile ([e4b57b9](https://github.com/eric-maydeck/bean-tracker/commit/e4b57b9b0cddf6a32bafcbd51ad5359617787613))
* add defaultViewForWidth helper for mobile view defaulting ([1e387b6](https://github.com/eric-maydeck/bean-tracker/commit/1e387b6f573891b4148f1dd5759791d768a32b28))
* add read-only Compact view to the Coffees page ([d893dfe](https://github.com/eric-maydeck/bean-tracker/commit/d893dfec1fcc14a93b3489b02177f2d1e819ebdf))
* add read-only Compact view to the Subscriptions page ([f2a8f55](https://github.com/eric-maydeck/bean-tracker/commit/f2a8f55f037171e4965418b6934aa4573c7ce8ec))
* wire admin editing into the Coffees Compact view ([525a523](https://github.com/eric-maydeck/bean-tracker/commit/525a523dd212405d30ece8e7439dcf279b132813))
* wire admin editing into the Subscriptions Compact view ([3198600](https://github.com/eric-maydeck/bean-tracker/commit/31986005c5a9d94c1e35866b0b2e41a690385fe9))

# [1.11.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.10.0...v1.11.0) (2026-09-19)


### Features

* sortable Processing/Frozen/Unfrozen/Decaf columns, drop Status column ([3b1f84a](https://github.com/eric-maydeck/bean-tracker/commit/3b1f84ac43a9e822a1af47f22ff9a5549a04c807))

# [1.10.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.4...v1.10.0) (2026-09-19)


### Features

* subscription totals/renewal date, decaf tracking, minor polish ([e99753f](https://github.com/eric-maydeck/bean-tracker/commit/e99753fa605e75c26ac50f68a0e7323589cfe280))

## [1.9.4](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.3...v1.9.4) (2026-09-19)


### Bug Fixes

* coffees list-view table layout issues ([fea1db8](https://github.com/eric-maydeck/bean-tracker/commit/fea1db8b02de8c901043fe0bdb9927f2dbb35e7f))

## [1.9.3](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.2...v1.9.3) (2026-09-19)


### Bug Fixes

* two Subscriptions bugs — case-sensitive sort, and Save blanking fields ([458802c](https://github.com/eric-maydeck/bean-tracker/commit/458802ccb117a36953aa637d10b4c1874340984c))

## [1.9.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.1...v1.9.2) (2026-09-19)


### Bug Fixes

* default Coffees list to Urgency descending, persist sort choice ([0f45db8](https://github.com/eric-maydeck/bean-tracker/commit/0f45db87e2f7a546b35ad17d895709735160f5aa))

## [1.9.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.9.0...v1.9.1) (2026-09-19)


### Bug Fixes

* session cookie was silently marked Secure over plain HTTP ([10d48f8](https://github.com/eric-maydeck/bean-tracker/commit/10d48f80124fc8b0738e722f7c9dc5b3b04cf215))

# [1.9.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.8.0...v1.9.0) (2026-09-19)


### Bug Fixes

* give the list-view Actions column real width in the colgroup ([ea2b4e7](https://github.com/eric-maydeck/bean-tracker/commit/ea2b4e7180250d05a3b989a5db3c3f6c50db7b81))
* re-check admin status before rendering edit affordances ([2f80723](https://github.com/eric-maydeck/bean-tracker/commit/2f807235727d5c9249db359f9c81f748337593a0))


### Features

* add a Refresh button to On Deck ([f640858](https://github.com/eric-maydeck/bean-tracker/commit/f640858a9327dad956a53f956f2f015d24f2829c))
* add app-owned admin authentication and login page ([a569aa3](https://github.com/eric-maydeck/bean-tracker/commit/a569aa35f88afbf46f4a789f5b852cc7c7c45606))
* add password hashing and session cookie signing ([f1c3462](https://github.com/eric-maydeck/bean-tracker/commit/f1c3462d222d628d580575309010ceea9fe84e9a))
* inline coffee editing on the Coffees page ([aa3e91c](https://github.com/eric-maydeck/bean-tracker/commit/aa3e91c837ec0af718be7440b5fc767ac95e4032))
* inline editing on the coffee detail page ([c801986](https://github.com/eric-maydeck/bean-tracker/commit/c80198693b4c3495529f762c9257b7a84a22d25f))
* move coffee write actions onto the Coffees page ([5805a47](https://github.com/eric-maydeck/bean-tracker/commit/5805a47ba84b06665d7005fa24cd4f228f9fcafd))
* move Subscriptions to a top-level route with inline editing ([1cd71ad](https://github.com/eric-maydeck/bean-tracker/commit/1cd71ad86dae0f15db0b5c36f47f9763f809849d))
* show the running app version in the footer ([90723ea](https://github.com/eric-maydeck/bean-tracker/commit/90723eae77ff690ad75f15dcc3e46b783b6e5a51))
* support inline create/cancel in CoffeeForm ([e80ced6](https://github.com/eric-maydeck/bean-tracker/commit/e80ced6e786613f10562f8191d280a9d62c414c7))

# [1.8.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.7.0...v1.8.0) (2026-09-18)


### Features

* add coffee delete, On Deck detail, and add-coffee autocomplete ([b133b08](https://github.com/eric-maydeck/bean-tracker/commit/b133b08749607358c478ac0e50947a7783a5872b))

# [1.7.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.6.0...v1.7.0) (2026-09-18)


### Features

* track last-deployed alongside last-updated, both durable in the db ([642f552](https://github.com/eric-maydeck/bean-tracker/commit/642f5520a75d93ad938ad423d279ce855bb2ae84))

# [1.6.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.5.0...v1.6.0) (2026-09-18)


### Features

* add an Unopen action to undo Open on the Manage page ([00cc34c](https://github.com/eric-maydeck/bean-tracker/commit/00cc34ce63960fbe3325615537bf0c90ba1d549a))
* add Manage tabs for coffees and subscriptions ([7b5923e](https://github.com/eric-maydeck/bean-tracker/commit/7b5923e0be79ae3eeacbb04b65c2c7becdbfc681))
* split Origin/Roast into separate sortable, searchable columns ([392e305](https://github.com/eric-maydeck/bean-tracker/commit/392e305e2f8772969d0cef40536918d7db4e0b63))

# [1.5.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.4.0...v1.5.0) (2026-09-18)


### Bug Fixes

* import the real Moved date for archived coffees from the spreadsheet ([b57b85d](https://github.com/eric-maydeck/bean-tracker/commit/b57b85d621b6769fb13fd9bcd028211ab12ec683))
* urgency gradient clamps at zero and Manage buttons stay aligned ([f36be5d](https://github.com/eric-maydeck/bean-tracker/commit/f36be5d6c4b5fb2b7d63c5ab642a4182cd782684))


### Features

* move subscription creation to a dedicated Manage page ([ddebcb1](https://github.com/eric-maydeck/bean-tracker/commit/ddebcb1de3d943184188094152389bd2f610aaa1))

# [1.4.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.3.1...v1.4.0) (2026-09-18)


### Bug Fixes

* store frozen dates as date-only and guard status transitions ([a0e436e](https://github.com/eric-maydeck/bean-tracker/commit/a0e436e12a14dae55ac233efa88249ec1f8f4d1b))
* use explicit .ts extension importing slug module ([522c1a2](https://github.com/eric-maydeck/bean-tracker/commit/522c1a26bee447553d137243227b78755f93ad9e))


### Features

* add coffee status lifecycle migration and URL slug generation ([9da3372](https://github.com/eric-maydeck/bean-tracker/commit/9da3372ba0380dfc6e599b97395d3f09c6a83177))
* add slug generation utility for coffee URL identifiers ([1e0427d](https://github.com/eric-maydeck/bean-tracker/commit/1e0427dc5363272c147e1f335fca9bee3d913cf0))
* add the On Deck page ([fd41ffe](https://github.com/eric-maydeck/bean-tracker/commit/fd41ffea89f2903f1740c856b074505b239947ce))
* home-page polish — reset button, stable columns, thumbnails, urgency gradient ([6f43226](https://github.com/eric-maydeck/bean-tracker/commit/6f43226f9cd5dad03278c3a78d39de86ef2d5678))
* make the coffee URL slug editable from the edit form ([7b2ada7](https://github.com/eric-maydeck/bean-tracker/commit/7b2ada76e9c8a53251ff0345cfec0a30c9e98e91))
* point nav at On Deck/Manage and migrate script at the new status values ([bba13e9](https://github.com/eric-maydeck/bean-tracker/commit/bba13e9570df7fb4eb40e5addf605b23b3e0983e))
* reduce Manage to an uncapped action list for the new lifecycle ([64227ca](https://github.com/eric-maydeck/bean-tracker/commit/64227caae89f9dcb103fe33354a5a5df5fee5b66))
* rework coffees data layer for the backlog/open/archive lifecycle ([3208926](https://github.com/eric-maydeck/bean-tracker/commit/32089262972c9dd9ff3c13ab2c32a0d653d86013))
* show frozen/opened/archived dates on the Archive page ([d47f0b2](https://github.com/eric-maydeck/bean-tracker/commit/d47f0b24818ee2f3b84ebe8a8fc2e6aab2d9593a))
* switch the coffee detail page to slug-based URLs ([74d0f3e](https://github.com/eric-maydeck/bean-tracker/commit/74d0f3ece18eaabc4d57f6203b53e079fafa34c5))
* update the home page for the three-state coffee lifecycle ([6a0ef2f](https://github.com/eric-maydeck/bean-tracker/commit/6a0ef2f863cba2d2a5aaa80c5281db4ce9157555))

## [1.3.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.3.0...v1.3.1) (2026-09-18)


### Bug Fixes

* redirect to the new coffee after adding it, not the dashboard ([8694277](https://github.com/eric-maydeck/bean-tracker/commit/869427775d0b5f71fe3e67ce78c2cb28e2322f90))

# [1.3.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.2.0...v1.3.0) (2026-09-18)


### Features

* coffee images, redesigned detail page, sortable list, footer ([f1cab4b](https://github.com/eric-maydeck/bean-tracker/commit/f1cab4b2199ed3e70a007d730900a8127d261294))

# [1.2.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.1.0...v1.2.0) (2026-09-18)


### Features

* design refresh — typography, dark mode toggle, responsive tables ([9b50cf2](https://github.com/eric-maydeck/bean-tracker/commit/9b50cf2de7b309e43470d035fa490ae9d1ca7a83))

# [1.1.0](https://github.com/eric-maydeck/bean-tracker/compare/v1.0.2...v1.1.0) (2026-09-17)


### Features

* make the backlog the home page, add site nav and view toggle ([8e0291b](https://github.com/eric-maydeck/bean-tracker/commit/8e0291baeab425effce7e4a618e71919ff4681f0))

## [1.0.2](https://github.com/eric-maydeck/bean-tracker/compare/v1.0.1...v1.0.2) (2026-09-17)


### Bug Fixes

* embed the DB schema as a TS string instead of a sibling .sql file ([d42c838](https://github.com/eric-maydeck/bean-tracker/commit/d42c838bd71e525031bb4e5a26562a1a0a9b703f))

## [1.0.1](https://github.com/eric-maydeck/bean-tracker/compare/v1.0.0...v1.0.1) (2026-09-17)


### Bug Fixes

* skip lifecycle scripts in the docker runtime stage ([dbaeb47](https://github.com/eric-maydeck/bean-tracker/commit/dbaeb47adefeb687103505b5763856cf2fb52b50))

# 1.0.0 (2026-09-17)


### Bug Fixes

* address final review findings in the CI/CD pipeline ([a1cf3b9](https://github.com/eric-maydeck/bean-tracker/commit/a1cf3b99d879d2dc9cf29b67d30c404c3a35c042))


### Features

* add Dockerfile for containerized deployment ([a63c192](https://github.com/eric-maydeck/bean-tracker/commit/a63c1921be5a3120b0d5e69bc3f371f926513869))
* add semantic-release configuration and release workflow ([5a0f237](https://github.com/eric-maydeck/bean-tracker/commit/5a0f2379acd5c3080a34281adae0b26b0708ff79))
* add workflow to build and publish the Docker image on release ([b3a2e0d](https://github.com/eric-maydeck/bean-tracker/commit/b3a2e0de0bbf920604fff1ebf8a631cce00a7a88))
