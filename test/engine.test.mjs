import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCore, challengeId, newRun, jump, step, makeCourse } from '../dist/engine.mjs';
const fixture = {schemaVersion:1,status:'available',chain:{chainId:'11155111',target:'sepolia',safeThroughBlock:'12014744',confirmations:'12'},identities:{core:'0x980b4424c007caf7a1f3670b48c8eaef7ebc3d44'},core:{settledThroughRound:'328',cumulativeBlockUnits:'2027753319164',blockHeight:'2027',workPerThousandBlocks:'11224',paused:false},source:{blockTimestamp:'1793219436'}};
test('Validates source network and rejects unavailable or malformed snapshots',()=>{
 assert.equal(parseCore(fixture).round,'328');
 assert.throws(()=>parseCore({...fixture,status:'unavailable'}));
 assert.throws(()=>parseCore({...fixture,chain:{...fixture.chain,chainId:'1'}}));
 assert.throws(()=>parseCore({...fixture,core:{...fixture.core,cumulativeBlockUnits:'oops'}}));
});
test('Course identity ignores fetch time and Ethereum index progress, but changes for a new round or core',()=>{
 const original = parseCore(fixture), id = challengeId(original);
 assert.equal(id,challengeId({...original,fetchedAt:123,ethereumBlock:'99999999'}));
 assert.notEqual(id,challengeId({...original,round:'329'}));
 assert.notEqual(id,challengeId({...original,core:'0x'+'1'.repeat(40)}));
 assert.deepEqual(makeCourse(id),makeCourse(id));
 assert.notDeepEqual(makeCourse(id),makeCourse(id+'1'));
});
test('Failing to jump ends the game, damage is not repeated on the same obstacle',()=>{
 const run=newRun('practice-v1');
 for(let i=0;i<120*60;i++)step(run,1/120);
 assert.equal(run.lives,0);assert.equal(run.done,true);assert.equal(run.won,false);
 const score=run.score;step(run,1);assert.equal(run.score,score);
});
test('Well timed jumps can clear a full course and collect seeds',()=>{
 for(const id of ['practice-v1',challengeId(parseCore(fixture)),'another course']) {
  const run=newRun(id);
  for(let i=0;i<120*61&&!run.done;i++) {
   const next=run.hazards.find(h=>h.at>run.elapsed);
   if(next&&next.at-run.elapsed<.43&&next.at-run.elapsed>.40&&run.y===0)jump(run);
   step(run,1/120);
  }
  assert.equal(run.won,true,id);assert.equal(run.lives,3,id);assert.ok(run.seeds>10,id);
 }
});
test('Jumping in midair cannot bypass obstacles by flying',()=>{
 const run=newRun('practice-v1');assert.equal(jump(run),true);step(run,1/120);assert.equal(jump(run),false);
});
