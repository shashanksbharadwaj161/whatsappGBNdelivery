import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '@prisma/client';
import {addToAutomaticRound} from '../lib/services/automatic-routes';

function fixture(count:number, existing=false){
 const writes: Array<{kind:string;data:Record<string,unknown>}> = [];
 const tx={
  $executeRaw:async()=>1,
  order:{findUniqueOrThrow:async()=>({id:'o1',status:'CONFIRMED',deliveryDate:new Date('2026-09-11'),customer:{name:'Test'},address:{latitude:13,longitude:77,formattedAddress:'Test address'},quantity:2,milkSize:'L1'})},
  routeStop:{findFirst:async()=>existing?{id:'old'}:null,create:async({data}:{data:Record<string,unknown>})=>{writes.push({kind:'stop',data});}},
  route:{findMany:async()=>[{id:'round1',_count:{stops:count}}],create:async({data}:{data:Record<string,unknown>})=>{writes.push({kind:'route',data});return {id:'round2',...data};},update:async()=>({})}
 };
 return {tx:tx as unknown as Prisma.TransactionClient,writes};
}
test('confirmed location goes into existing round with contact and quantity snapshots',async()=>{
 const {tx,writes}=fixture(3); await addToAutomaticRound(tx,'o1');
 assert.equal(writes.length,1);assert.equal(writes[0].data.routeId,'round1');assert.equal(writes[0].data.stopNumber,4);assert.equal(writes[0].data.quantitySnapshot,'2× 1 L');assert.equal(writes[0].data.latitudeSnapshot,13);
});
test('full round creates a separate round awaiting actual driver GPS',async()=>{
 const {tx,writes}=fixture(25); await addToAutomaticRound(tx,'o1');
 assert.equal(writes[0].kind,'route');assert.equal(writes[0].data.awaitingDriverLocation,true);assert.equal(writes[0].data.returnToStart,false);assert.equal(writes[1].data.routeId,'round2');assert.equal(writes[1].data.stopNumber,1);
});
test('replayed order never adds another active stop',async()=>{
 const {tx,writes}=fixture(2,true);await addToAutomaticRound(tx,'o1');assert.equal(writes.length,0);
});
test('late order joins an unstarted round and forces a GPS recalculation',async()=>{
 let roundQuery:Record<string,unknown>|undefined; const updates:Array<Record<string,unknown>>=[];
 const tx={
  $executeRaw:async()=>1,
  order:{findUniqueOrThrow:async()=>({id:'o1',status:'CONFIRMED',deliveryDate:new Date('2026-09-11'),customer:{name:'Test'},address:{latitude:13,longitude:77,formattedAddress:'Test address'},quantity:1,milkSize:'ML500'})},
  routeStop:{findFirst:async()=>null,create:async()=>({})},
  route:{findMany:async({where}:{where:Record<string,unknown>})=>{roundQuery=where;return [{id:'planned',_count:{stops:4}}];},create:async()=>({id:'x'}),update:async({data}:{data:Record<string,unknown>})=>{updates.push(data);return {};}}
 } as unknown as Prisma.TransactionClient;
 await addToAutomaticRound(tx,'o1');
 // Only rounds that have not yet departed are eligible to absorb a new order.
 assert.equal(roundQuery?.startedAt,null);
 // Joining flips the round back to awaiting GPS so the order is recomputed.
 assert.equal(updates.length,1);assert.equal(updates[0].awaitingDriverLocation,true);
});
