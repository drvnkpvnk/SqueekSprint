export const DURATION = 60;
export const API_URL = 'https://api.squeekchain.com/v1/core';
const uint = value => typeof value === 'string' && /^\d{1,78}$/.test(value);
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

// Provenance from the official API, not independent on-chain verification.
export function parseCore(raw) {
  if (raw?.schemaVersion !== 1 || raw.status !== 'available') throw new Error('Squeekchain data is unavailable.');
  if (String(raw.chain?.chainId) !== '11155111' || raw.chain?.target !== 'sepolia') throw new Error('The API is not reporting Sepolia.');
  const c = raw.core;
  if (!address(raw.identities?.core) || !uint(c?.settledThroughRound) || !uint(c?.cumulativeBlockUnits) || !uint(c?.blockHeight) || !uint(c?.workPerThousandBlocks) || !uint(raw.chain.safeThroughBlock)) throw new Error('The API format has changed.');
  const ts = Number(raw.source?.blockTimestamp);
  return {
    version: 1, network: 'sepolia', core: raw.identities.core.toLowerCase(),
    round: c.settledThroughRound, work: c.workPerThousandBlocks,
    units: c.cumulativeBlockUnits, height: c.blockHeight,
    ethereumBlock: raw.chain.safeThroughBlock,
    confirmations: String(raw.chain.confirmations ?? 'unknown'),
    settledAt: Number.isFinite(ts) && ts > 0 ? ts * 1000 : null,
    fetchedAt: Date.now(), paused: c.paused === true,
    transaction: /^0x[0-9a-fA-F]{64}$/.test(raw.source?.transactionHash) ? raw.source.transactionHash : null,
    installation: typeof raw.installationId === 'string' ? raw.installationId.slice(0, 120) : null,
  };
}

export function challengeId(snapshot) {
  return snapshot ? `v1:${snapshot.core}:${snapshot.round}:${snapshot.units}:${snapshot.work}` : 'practice-v1';
}
export function hashSeed(text) {
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function randomFrom(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6D2B79F5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function makeCourse(id) {
  const random = randomFrom(hashSeed(id));
  const hazards = [], seeds = [];
  let at = 3.5;
  while (at < DURATION - 2) {
    const type = random() < 0.5 ? 'rock' : 'cactus';
    hazards.push({ at, type });
    seeds.push({ at: at - 0.12, elevation: 105 });
    if (random() > 0.35) seeds.push({ at: at + 0.9, elevation: 24 });
    at += 1.7 + random() * 1.1;
  }
  return { hazards, pickups: seeds };
}
export function scoreFor(seconds, collected) { return Math.floor(seconds * 10) + collected * 50; }
export function newRun(id) {
  const course = makeCourse(id);
  return { id, elapsed: 0, y: 0, vy: 0, lives: 3, invincible: 0, seeds: 0, score: 0, done: false, won: false, ...course, hit: new Set(), collected: new Set() };
}
export function jump(run) {
  if (run.done || run.y > 0.1) return false;
  run.vy = 680;
  return true;
}
// Fixed steps keep collisions consistent across display refresh rates.
export function step(run, dt) {
  if (run.done) return;
  run.elapsed = Math.min(DURATION, run.elapsed + dt);
  run.vy -= 1750 * dt;
  run.y = Math.max(0, run.y + run.vy * dt);
  if (run.y === 0) run.vy = 0;
  run.invincible = Math.max(0, run.invincible - dt);
  run.hazards.forEach((h, i) => {
    const dx = (h.at - run.elapsed) * 310;
    if (!run.hit.has(i) && Math.abs(dx) < 29 && run.y < (h.type === 'cactus' ? 47 : 31)) {
      run.hit.add(i);
      if (run.invincible === 0) { run.lives--; run.invincible = 1.1; }
    }
  });
  run.pickups.forEach((s, i) => {
    const dx = (s.at - run.elapsed) * 310;
    if (!run.collected.has(i) && Math.abs(dx) < 35 && Math.abs(run.y + 25 - s.elevation) < 42) {
      run.collected.add(i); run.seeds++;
    }
  });
  run.score = scoreFor(run.elapsed, run.seeds);
  if (run.lives <= 0 || run.elapsed >= DURATION) { run.done = true; run.won = run.lives > 0; }
}
