import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRouteAccessible, claimedDriverId, type RouteActor } from '../lib/services/routes';
import { ForbiddenError } from '../lib/errors';

const owner: RouteActor = { userId: 'owner-1', role: 'OWNER' };
const driverA: RouteActor = { userId: 'driver-a', role: 'DRIVER' };
const driverB: RouteActor = { userId: 'driver-b', role: 'DRIVER' };

const unassigned = { driverId: null };
const roundOfA = { driverId: driverA.userId };
const roundOfB = { driverId: driverB.userId };

test('owner can access every round regardless of which driver owns it', () => {
  assert.doesNotThrow(() => assertRouteAccessible(unassigned, owner));
  assert.doesNotThrow(() => assertRouteAccessible(roundOfA, owner));
  assert.doesNotThrow(() => assertRouteAccessible(roundOfB, owner));
});

test('a driver can access an unassigned (claimable) round or their own round', () => {
  assert.doesNotThrow(() => assertRouteAccessible(unassigned, driverA));
  assert.doesNotThrow(() => assertRouteAccessible(roundOfA, driverA));
  assert.doesNotThrow(() => assertRouteAccessible(roundOfB, driverB));
});

test('a driver cannot access another driver\'s round, both directions', () => {
  const forbidden = (err: unknown) => err instanceof ForbiddenError && (err as ForbiddenError).status === 403;
  assert.throws(() => assertRouteAccessible(roundOfB, driverA), forbidden);
  assert.throws(() => assertRouteAccessible(roundOfA, driverB), forbidden);
});

test('a driver claims an unassigned round; an owner never becomes its driver', () => {
  assert.equal(claimedDriverId(null, driverA), driverA.userId);
  assert.equal(claimedDriverId(null, driverB), driverB.userId);
  assert.equal(claimedDriverId(null, owner), null);
});

test('an existing driver assignment is never overwritten by another actor', () => {
  // Driver B acting on A's round (e.g. owner-assigned) keeps A as the driver;
  // an owner re-planning A's round likewise leaves A assigned.
  assert.equal(claimedDriverId(driverA.userId, driverB), driverA.userId);
  assert.equal(claimedDriverId(driverA.userId, owner), driverA.userId);
  assert.equal(claimedDriverId(driverA.userId, driverA), driverA.userId);
});
