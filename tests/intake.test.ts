import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceIntake, type Intake } from '../lib/whatsapp/intake';

test('order needs explicit confirmation after all delivery details',()=>{
 let state:Intake|null=null;
 for(const text of ['ORDER','Test Customer','1L','2','2026-09-11','Flat 1, Example Road, Bengaluru 560064']) state=advanceIntake(state,text,null,'2026-09-09').state;
 assert.equal(state?.step,'location');
 assert.equal(advanceIntake(state,'560064',null,'2026-09-09').state.step,'location');
 state=advanceIntake(state,'',{lat:13.1,lng:77.6},'2026-09-09').state;
 const review=advanceIntake(state,'SKIP',null,'2026-09-09');
 assert.equal(review.confirm,undefined); assert.match(review.reply,/₹245/);
 assert.equal(advanceIntake(review.state,'CONFIRM',null,'2026-09-09').confirm,true);
});
test('reject invalid dates, quantities and allow human handoff',()=>{
 assert.equal(advanceIntake({step:'date'},'2026-02-30',null,'2026-01-01').state.step,'date');
 assert.equal(advanceIntake({step:'quantity'},'-2',null,'2026-09-09').state.step,'quantity');
 assert.equal(advanceIntake({step:'confirm'},'AGENT',null,'2026-09-09').state.step,'human');
});
