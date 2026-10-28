# Squeek Sprint

An independent, open-source-ready community arcade game built with the Squeekchain public API. A hamster runs for 60 seconds, jumps over obstacles and collects sunflower seeds. No wallet connection, token purchase or transaction is required.

## Run locally

Requires Node.js 22 or newer. There are no npm dependencies.

```sh
node serve.mjs
```

Open http://127.0.0.1:4173. To run the tests:

```sh
node --test test/engine.test.mjs
```

## The Squeekchain integration

The game reads https://api.squeekchain.com/v1/core directly from the browser. The endpoint allowed cross-origin reads when checked on 2026-10-28. It validates schema version 1, available status, the Sepolia chain ID (11155111), the Core address and the numeric fields used by the game.

The deterministic course seed contains:

- The Core contract address returned by the official API.
- The latest settled round number.
- Cumulative block units.
- Work per thousand blocks (difficulty).
- The course algorithm version.

The current course is frozen during a run. Press Refresh between runs to fetch a new snapshot. Fetch timestamps and settlement age are displayed separately. The source drawer links to the actual Core and settlement transaction. The game's source is API-reported data, not independent on-chain verification. Ethereum confirmation depth is read from the response.

If the API is unavailable, the game uses a clearly labeled fixed practice course. If a later refresh fails, the previous recorded course is explicitly labeled as such. Stale API index regressions do not replace an accepted snapshot. There are no hardcoded contract addresses in the application.

Shared links reproduce an exact course through a URL fragment. They are explicitly labeled as user-provided, unverified seeds, not authenticated blockchain snapshots. Scores and records are local to the browser. They are not tamper-resistant and there is no global competitive leaderboard.

## Controls

- Space, Arrow Up, click/tap the playfield, or the Jump button: jump.
- P, Escape, or Pause: pause/resume.
- Changing tabs or losing window focus pauses the game.
- 3 lives; 60 seconds; 10 points per second plus 50 per seed.

The artwork is original procedural canvas art. It does not use Squeek NFT images. Game points are not SQK and gameplay does not mint assets or automatically qualify for any badge.

## Hosting

The entire production site is in `dist/`. Upload that directory to any static host, including Render Static Sites or GitHub Pages. No build command or environment secrets are needed. For GitHub Pages, use a static deployment that publishes the contents of `dist/` as the site root. Relative asset paths support repository subpaths.

The `.openai/hosting.json` file belongs to the private Sites preview deployment. It is not needed for GitHub Pages or Render.

## Squeekchain builder badge

This is a real project candidate, not a badge guarantee. The badge description shown in Squeekchain's UI says a GitHub repository can qualify after proving control through a challenge file. The exact current process must be followed in the Squeekchain submission UI:

1. Publish this project's source in a GitHub repository you control.
2. Submit that repository in Squeekchain's builder flow.
3. Add the exact challenge filename, path and contents generated for your account. Do not invent a challenge value.
4. Keep the file in the required branch and location. The UI says repositories are rechecked daily and removing the file revokes the badge.
5. Keep the required wallet and X account linked, and comply with the program's account eligibility requirements.

The application never asks for a private key, seed phrase or wallet signature.

## Source map

- `dist/engine.mjs`: deterministic course generation, source validation and fixed-step simulation.
- `dist/game.mjs`: browser integration, game controls, original renderer and local score storage.
- `dist/index.html`, `dist/style.css`: accessible responsive interface.
- `test/engine.test.mjs`: source rejection, determinism, collision and full-course playability checks.
- `serve.mjs`: dependency-free local development server.

Official references: https://docs.squeekchain.com/developers/api/ and https://docs.squeekchain.com/developers/build-with-ai/.

Independent community project. Not affiliated with or endorsed by Squeekchain.
