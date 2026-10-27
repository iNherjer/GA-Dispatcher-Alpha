import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sortUsers, usageSummary } from './user-list-core.mjs';
const now = Date.parse('2026-10-26T12:00:00Z');
const iso = ms => new Date(ms).toISOString();
const hour = 3600000;

test('rolling usage windows count accounts, include exact boundaries and exclude future or missing timestamps', () => {
  const users = [0,24,24.001,168,168.001,-1].map(age => ({lastAppSeen:iso(now-age*hour)}));
  users.push({lastAppSeen:''},{lastAppSeen:'invalid'},{lastModified:iso(now)});
  assert.deepEqual(usageSummary(users,now),{total:9,active24h:2,active7d:4,unknownActivity:4,asOf:iso(now)});
});

test('sorts names, usage and registration in either direction, with unknown dates always last', () => {
  const users = [
    {id:'B',name:'beta',lastAppSeen:iso(now),registeredAt:iso(now-10*hour)},
    {id:'C',name:'Charlie',lastAppSeen:'',registeredAt:''},
    {id:'A',name:'Alpha',lastAppSeen:iso(now-hour),registeredAt:iso(now-hour)}
  ];
  const ids = (field,direction) => sortUsers(users,field,direction).map(user => user.id);
  assert.deepEqual(ids('name','asc'),['A','B','C']);
  assert.deepEqual(ids('name','desc'),['C','B','A']);
  assert.deepEqual(ids('lastAppSeen','desc'),['B','A','C']);
  assert.deepEqual(ids('lastAppSeen','asc'),['A','B','C']);
  assert.deepEqual(ids('registeredAt','desc'),['A','B','C']);
  assert.deepEqual(ids('registeredAt','asc'),['B','A','C']);
  assert.deepEqual(users.map(user => user.id),['B','C','A']);
});
