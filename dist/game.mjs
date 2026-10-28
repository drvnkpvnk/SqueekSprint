import { API_URL, DURATION, parseCore, challengeId, hashSeed, newRun, jump, step } from './engine.mjs';
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
let snapshot = null, selectedId = 'practice-v1', sourceKind = 'practice';
let run = null, state = 'ready', lastResult = null, accumulator = 0, lastFrame = 0;
let width = 1080, height = 420, ground = 343, playerX = 165;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const codeFor = id => hashSeed(id).toString(16).toUpperCase().padStart(8, '0');
const padded = n => String(n).padStart(4, '0');
let storageAvailable = true;
function readSaved(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeSaved(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageAvailable = false; } }
const savedScores = readSaved('squeek-sprint-best-v1', {});
const bestScores = savedScores && typeof savedScores === 'object' && !Array.isArray(savedScores) ? savedScores : {};
function bestFor(id) { const n = bestScores?.[id]; return Number.isFinite(n) && n >= 0 ? n : 0; }
function updateBest() { $('best-score').textContent = padded(bestFor(selectedId)); }
function roundLabel(id) { return id === 'practice-v1' ? 'Practice' : `Round #${id.split(':')[2]}`; }
function displaySelection() {
  $('game-mode').textContent = sourceKind === 'shared' ? `SHARED COURSE · ${roundLabel(selectedId).toUpperCase()}` : snapshot ? `SEPOLIA · ROUND #${snapshot.round}` : 'PRACTICE RUN';
  $('round-number').textContent = selectedId === 'practice-v1' ? 'PRACTICE' : `ROUND #${selectedId.split(':')[2]}`;
  $('round-caption').textContent = sourceKind === 'shared' ? 'Shared course · unverified seed' : snapshot ? 'Based on a settled Sepolia round' : 'A fixed course. A fresh start.';
  $('seed-code').textContent = codeFor(selectedId);
  $('data-dot').classList.toggle('ready', sourceKind === 'api');
  updateBest();
}
function formatAge(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
function renderSource() {
  $('block-height').textContent = snapshot ? Number(snapshot.height).toLocaleString('en-US') : '—';
  $('settled-round').textContent = snapshot?.round ?? (sourceKind === 'shared' && selectedId !== 'practice-v1' ? selectedId.split(':')[2] : '—');
  const coreLink = $('core-link'), txLink = $('tx-link');
  if (snapshot) {
    const age = snapshot.settledAt ? `Settlement ${formatAge(Date.now() - snapshot.settledAt)}.` : 'Settlement time unknown.';
    $('source-status').textContent = `Fetched ${new Date(snapshot.fetchedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}. ${age}${snapshot.paused ? ' Core paused.' : ''}`;
    $('provenance').textContent = `Course v1 uses Core ${snapshot.core}, settled round ${snapshot.round}, cumulative block units ${snapshot.units}, and difficulty ${snapshot.work}. API snapshot at Ethereum Sepolia block ${snapshot.ethereumBlock}; reported confirmation depth: ${snapshot.confirmations}. Data is reported by the official API, not independently verified here.`;
    coreLink.href = `https://sepolia.etherscan.io/address/${snapshot.core}`; coreLink.textContent = 'View Core contract ↗';
    txLink.href = snapshot.transaction ? `https://sepolia.etherscan.io/tx/${snapshot.transaction}` : API_URL;
    txLink.textContent = snapshot.transaction ? 'Settlement transaction ↗' : 'API snapshot ↗';
  } else {
    coreLink.href = 'https://docs.squeekchain.com/developers/api/'; coreLink.textContent = 'API documentation ↗';
    txLink.href = API_URL; txLink.textContent = 'Official API ↗';
    $('provenance').textContent = sourceKind === 'shared' ? 'This link contains a course seed provided by another player. It reproduces their obstacle layout; it is not proof that the seed came from Squeekchain. Refresh to load official API data.' : 'Practice uses a fixed local seed while the public API is unavailable. It does not represent live blockchain activity.';
  }
  displaySelection();
}
async function refreshData() {
  if (state === 'playing' || state === 'paused') return;
  $('refresh-button').disabled = true; $('play-button').disabled = true;
  $('source-status').textContent = 'Checking the official public API…';
  try {
    const response = await fetch(API_URL, { signal: AbortSignal.timeout(10000), cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('The public API did not respond.');
    const next = parseCore(await response.json());
    if (snapshot && snapshot.core === next.core && BigInt(next.ethereumBlock) < BigInt(snapshot.ethereumBlock)) {
      $('source-status').textContent = 'API returned an older snapshot. Keeping the recorded course.';
    } else {
      snapshot = next; sourceKind = 'api'; selectedId = challengeId(snapshot);
      history.replaceState(null, '', location.pathname + location.search);
      renderSource();
    }
  } catch (error) {
    if (!snapshot) { sourceKind = 'practice'; selectedId = 'practice-v1'; renderSource(); }
    $('source-status').textContent = snapshot ? 'Refresh unavailable. Using the previous recorded snapshot.' : 'API unavailable. Practice mode is ready.';
  } finally { $('refresh-button').disabled = false; $('play-button').disabled = false; }
}
function setOverlay(kicker, title, copy, button) {
  $('overlay-kicker').textContent = kicker; $('overlay-title').textContent = title;
  $('overlay-copy').textContent = copy; $('play-button').textContent = `${button} →`; $('overlay').hidden = false;
}
function start() {
  if ($('play-button').disabled) return;
  if (state === 'paused') { resume(); return; }
  run = newRun(selectedId); state = 'playing'; accumulator = 0; lastFrame = 0;
  $('overlay').hidden = true; $('hud').hidden = false;
  $('pause-button').disabled = false; $('pause-button').textContent = 'Pause'; $('refresh-button').disabled = true;
  $('copy-status').textContent = '';
  $('play-button').blur();
  updateHud();
}
function pause() {
  if (state !== 'playing') return;
  state = 'paused'; $('pause-button').textContent = 'Resume';
  setOverlay('TAKE A BREATHER', 'Little legs. Big break.', 'Your run is paused. Nothing moves until you are ready.', 'Keep going');
}
function resume() {
  if (state !== 'paused') return;
  state = 'playing'; accumulator = 0; lastFrame = 0;
  $('overlay').hidden = true; $('pause-button').textContent = 'Pause';
}
function updateHud() {
  $('hearts').textContent = '♥ '.repeat(run.lives) + '♡ '.repeat(3 - run.lives);
  $('hearts').setAttribute('aria-label', `${run.lives} lives`);
  $('score').textContent = padded(run.score); $('timer').textContent = `${Math.ceil(DURATION - run.elapsed)}s`;
  $('progress-fill').style.width = `${run.elapsed / DURATION * 100}%`;
}
function renderResult(result) {
  $('last-empty').hidden = true; $('last-result').hidden = false;
  $('result-score').textContent = result.score.toLocaleString('en-US');
  $('result-detail').textContent = `${result.round} · ${result.seconds}s · ${result.seeds} seeds. Course ${codeFor(result.id)}. ${storageAvailable ? 'Saved on this device.' : 'Storage unavailable; this session only.'}`;
}
function finish() {
  state = 'over'; $('pause-button').disabled = true; $('refresh-button').disabled = false;
  const record = run.score > bestFor(selectedId);
  bestScores[selectedId] = Math.max(run.score, bestFor(selectedId));
  // Bound local storage growth over many different API rounds.
  const keys = Object.keys(bestScores); keys.slice(0, Math.max(0, keys.length - 100)).forEach(k => delete bestScores[k]);
  writeSaved('squeek-sprint-best-v1', bestScores);
  lastResult = { id: selectedId, score: run.score, seeds: run.seeds, seconds: Math.floor(run.elapsed), round: roundLabel(selectedId) };
  writeSaved('squeek-sprint-last-v1', lastResult); renderResult(lastResult); updateBest();
  setOverlay(record ? 'A NEW PERSONAL BEST' : run.won ? 'FINISH LINE FOUND' : 'SMALL HAMSTER, GREAT EFFORT', run.won ? 'That was a big sprint.' : 'One more little run?', `${run.score} points · ${run.seeds} seeds · ${Math.floor(run.elapsed)} seconds`, 'Run it again');
}
function doJump() {
  if (state === 'ready' || state === 'over') { start(); return; }
  if (state === 'paused') { resume(); return; }
  jump(run);
}
$('play-button').addEventListener('click', start);
$('jump-button').addEventListener('pointerdown', e => { e.preventDefault(); doJump(); });
canvas.addEventListener('pointerdown', e => { e.preventDefault(); doJump(); });
$('pause-button').addEventListener('click', () => state === 'playing' ? pause() : resume());
$('refresh-button').addEventListener('click', refreshData);
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  // Let keyboard activation of buttons and links keep its normal meaning.
  if ((e.code === 'Space' || e.code === 'Enter') && /BUTTON|A|SUMMARY/.test(e.target.tagName)) return;
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doJump(); }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'playing') pause(); else if (state === 'paused') resume(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
$('copy-button').addEventListener('click', async () => {
  if (!lastResult) return;
  const url = new URL(location.href); url.hash = `course=${encodeURIComponent(lastResult.id)}`;
  const text = `I scored ${lastResult.score} points in Squeek Sprint! ${lastResult.round}, course ${codeFor(lastResult.id)}. Can you beat it?\n${url.href}`;
  try { await navigator.clipboard.writeText(text); $('copy-status').textContent = 'Copied! Same link, same course.'; }
  catch { $('copy-status').textContent = text; }
});

// Original procedural pixel art. No NFT artwork is copied or fetched.
function rect(x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h)); }
function circle(x,y,r,color) { ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
const sprite = [
 '    aa       aa    ', '   abba     abba   ', '   abbaaaaaaabba   ',
 '   aaaaaaaaaaaaa  ', '  aaaaacaaaaacaaa ', ' aaaaacdaaaacdaaa ',
 ' aaaaacaaaaaacaaaa', ' aaaaeeeeeeeeaaaaa', ' aaeeeeefeeeeeeaaa',
 ' aaeeeeeeeeeeeeaaa', '  aeeeeeeeeeeeaaa ', '   aaeeeeeeeeaaa  ',
 '    aaaaaaaaaa    ', '     gg   gg      '];
const palette={a:'#db9c65',b:'#eab0a0',c:'#30262e',d:'#fff0d4',e:'#f6d8a5',f:'#b8665d',g:'#b77a56'};
function hamster(x,y,scale,time,air=false) {
  ctx.save(); ctx.translate(Math.round(x-9*scale),Math.round(y-14*scale));
  sprite.forEach((row,j)=>[...row].forEach((p,i)=>{if(palette[p])rect(i*scale,j*scale,scale,scale,palette[p]);}));
  if (!air) { const f = Math.floor(time*13)%2; rect((f?5:4)*scale,13*scale,3*scale,scale,palette.g); rect((f?11:10)*scale,13*scale,3*scale,scale,palette.g); }
  ctx.restore();
}
function wheel(x,y,r,time) {
  ctx.save(); ctx.strokeStyle='#71524c'; ctx.lineWidth=9; ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#c28764';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,r-10,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='#614841';ctx.lineWidth=3;
  for(let n=0;n<12;n++){const a=n*Math.PI/6+time*.12;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a)*(r-12),y+Math.sin(a)*(r-12));ctx.stroke();}
  circle(x,y,13,'#a56d54');circle(x,y,5,'#312a31');
  rect(x-7,y+8,14,r+7,'#87634e');rect(x-44,y+r+9,88,8,'#a87c5a');ctx.restore();
}
function drawSeed(x,y,time) {
  ctx.save();ctx.translate(x,y+Math.sin(time*4)*2);ctx.rotate(-.3);
  rect(-7,-10,14,20,'#f1bf6d');rect(-4,-14,8,5,'#f1bf6d');rect(-4,10,8,4,'#cc8f51');rect(-1,-9,3,19,'#9b7048');ctx.restore();
}
function drawHazard(x,type) {
  if(type==='rock'){rect(x-20,ground-21,41,21,'#9a7264');rect(x-13,ground-32,25,11,'#b78d78');rect(x-9,ground-29,14,5,'#ceb198');rect(x+12,ground-16,10,16,'#71564f');}
  else {rect(x-7,ground-54,15,54,'#738b74');rect(x-4,ground-51,4,44,'#9ca880');rect(x-21,ground-37,7,19,'#738b74');rect(x-16,ground-24,11,7,'#738b74');rect(x+7,ground-29,14,7,'#738b74');rect(x+16,ground-43,7,21,'#738b74');}
}
function resize() {
  const box = canvas.getBoundingClientRect();
  width = Math.max(560, Math.round(box.width / box.height * height));
  playerX = width < 800 ? 115 : 165;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = width*dpr; canvas.height = height*dpr; ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
}
new ResizeObserver(resize).observe(canvas);
function draw(time) {
  const moving = state==='playing' ? run.elapsed : 0;
  rect(0,0,width,height,'#29252c');
  // Stars, a soft copper sun, and slow parallax hills.
  for(let i=0;i<38;i++){const x=(i*173+47)%width;const y=30+(i*67)%175;rect(x,y,i%4===0?3:2,2,i%3===0?'#7d655e':'#51434a');}
  circle(width*.78,137,58,'#805444');circle(width*.78,137,45,'#b37552');
  ctx.fillStyle='#3c3035';ctx.beginPath();ctx.moveTo(0,270);
  for(let x=0;x<=width+100;x+=70)ctx.lineTo(x,245+Math.sin((x+moving*18)/160)*25);ctx.lineTo(width,ground);ctx.lineTo(0,ground);ctx.fill();
  ctx.fillStyle='#4e3939';ctx.beginPath();ctx.moveTo(0,310);
  for(let x=0;x<=width+100;x+=50)ctx.lineTo(x,290+Math.sin((x+moving*30)/100)*25);ctx.lineTo(width,ground);ctx.lineTo(0,ground);ctx.fill();
  const wheelX = state==='ready' ? width*.76 : width*.86 - (moving*24)%(width+380);
  wheel(wheelX,ground-115,103,state==='ready'&&!reducedMotion?time: moving);
  rect(0,ground,width,6,'#c99c73');rect(0,ground+6,width,8,'#8a6352');rect(0,ground+14,width,height-ground,'#443136');
  for(let i=0;i<50;i++){const x=(i*47-moving*310%(width+30)+width+30)%(width+30);rect(x,ground+22+(i*13)%45,i%3?5:11,3,i%2?'#6d4a43':'#815648');}
  if(state==='ready') {
    hamster(width*.76,ground,6, reducedMotion?0:time);
    drawSeed(width*.9,ground-55,time);drawSeed(width*.95,ground-86,time);
  } else if(run) {
    run.hazards.forEach(h=>{const x=playerX+(h.at-run.elapsed)*310;if(x>-50&&x<width+50)drawHazard(x,h.type);});
    run.pickups.forEach((s,i)=>{const x=playerX+(s.at-run.elapsed)*310;if(!run.collected.has(i)&&x>-20&&x<width+20)drawSeed(x,ground-s.elevation,run.elapsed);});
    circle(playerX,ground+1,20,'#523830');
    if(run.invincible===0||Math.floor(run.elapsed*13)%2===0)hamster(playerX,ground-run.y,3.5,run.elapsed,run.y>0);
    if(state==='playing'&&run.y===0){rect(playerX-40,ground-5,7,4,'#a27960');rect(playerX-53,ground-2,5,3,'#76564b');}
  }
}
function frame(time) {
  if (state==='playing') {
    if(lastFrame) accumulator += Math.min((time-lastFrame)/1000,.1);
    while(accumulator>=1/120 && state==='playing') {step(run,1/120);accumulator-=1/120;if(run.done)finish();}
    updateHud();
  }
  lastFrame=time;draw(time/1000);requestAnimationFrame(frame);
}
const previous = readSaved('squeek-sprint-last-v1', null);
if(previous && typeof previous.id==='string' && Number.isFinite(previous.score) && Number.isFinite(previous.seconds) && Number.isFinite(previous.seeds) && typeof previous.round==='string') {lastResult=previous;renderResult(previous);}
let shared = null;
try {const value=new URLSearchParams(location.hash.slice(1)).get('course');if(value && /^(practice-v1|v1:0x[0-9a-f]{40}:\d{1,78}:\d{1,78}:\d{1,78})$/.test(value))shared=value;}catch{}
if(shared){selectedId=shared;sourceKind='shared';$('source-status').textContent='Shared course seed. Refresh for official API data.';renderSource();}
else refreshData();
window.addEventListener('hashchange', () => {
  const value = new URLSearchParams(location.hash.slice(1)).get('course');
  if (value && value !== selectedId && /^(practice-v1|v1:0x[0-9a-f]{40}:\d{1,78}:\d{1,78}:\d{1,78})$/.test(value)) location.reload();
});
resize();requestAnimationFrame(frame);
