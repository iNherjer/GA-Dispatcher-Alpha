import assert from 'node:assert/strict';
import { mergeOurAirports, parseCsv, readOurAirportsSnapshot } from './ourairports-import.mjs';

const source = { includedTypes: ['small_airport', 'medium_airport', 'large_airport', 'seaplane_base'] };
const row = (id, properties = {}) => ({ id: String(id), ident: `BW-${id}`, type: 'small_airport',
  name: `Place ${id}`, iso_country: 'BW', latitude_deg: '-20', longitude_deg: '23',
  elevation_ft: '', icao_code: '', gps_code: '', local_code: '', iata_code: '', ...properties });
const database = {
  FBAA: { icao: 'FBAA', name: 'Existing', country: 'BW', lat: -20, lon: 23, elevation: 3000, type: 11 },
  'OA-POM': { icao: 'OA-POM', name: 'POM POM', country: 'BW', lat: -19.595556, lon: 22.844444, elevation: 10367, type: 11 },
  FBZZ: { icao: 'FBZZ', name: 'Closed', country: 'BW', lat: -18, lon: 23, type: 8 }
};
const rows = [
  row(1, { ident: 'FBAA', icao_code: 'FBAA', elevation_ft: '3020', name: 'Renamed' }),
  row(2, { name: 'Pom Pom Airport', latitude_deg: '-19.59728', longitude_deg: '22.848081', elevation_ft: '3150' }),
  row(3, { latitude_deg: '-17', icao_code: 'FBCC', gps_code: 'FBCC', elevation_ft: '4567' }),
  row(4, { latitude_deg: '-16', local_code: 'XYZ', name: 'No official ICAO' }),
  row(5, { latitude_deg: '-15', iso_country: 'KE', local_code: 'XYZ' }),
  row(6, { latitude_deg: '-14', icao_code: 'FBAA' }),
  row(7, { latitude_deg: '-18', icao_code: 'FBZZ' }),
  row(8, { latitude_deg: '-20.001', name: 'Possibly same place' }),
  row(9, { latitude_deg: '-13', type: 'closed' }),
  row(10, { latitude_deg: '-12', type: 'heliport' })
];
const report = mergeOurAirports(database, rows, source);
assert.equal(report.matchedCount, 2);
assert.equal(report.addedCount, 3);
assert.deepEqual(report.conflicts.map(c => c.reason), ['code-position-conflict', 'closed-existing-place', 'nearby-place-review']);
assert.equal(database.FBAA.name, 'Existing');
assert.equal(database.FBAA.type, 11);
assert.equal(database.FBAA.elevation, 3000);
assert.equal(database['OA-POM'].elevation, 10367, 'height conflicts must be reported, never silently overwritten');
assert.equal(report.fieldDifferences[0].ourAirports, 3150);
assert.ok(database['OA-POM'].aliases.includes('BW-2'));
assert.equal(database.FBCC.elevation, 4567, 'OurAirports elevation is already in feet');
assert.equal(database.FBCC.icaoCode, 'FBCC');
assert.equal(database['OUR-4'].icaoCode, undefined, 'internal identifier must not become an ICAO code');
assert.equal(database['OUR-4'].elevation, null, 'missing height must remain unknown');
assert.ok(!database['OUR-4'].aliases.includes('XYZ'), 'ambiguous local codes must not become global aliases');
assert.ok(!database['OUR-5'].aliases.includes('XYZ'));
assert.ok(!database['OUR-9'] && !database['OUR-10']);
const first = JSON.stringify(database);
mergeOurAirports(database, rows, source);
assert.equal(JSON.stringify(database), first, 'repeated import must not add duplicates or mutate existing records');

const faa = { airports: { '1A2': { ourairports_ident: 'US-123', country: 'US' } } };
const faaDb = {};
mergeOurAirports(faaDb, [row(11, { ident: 'US-123', iso_country: 'US', local_code: '1A2' })], source, faa);
assert.ok(faaDb['1A2'], 'FAA supplemental records must retain their canonical key');
assert.equal(Object.keys(faaDb).length, 1);

const header = 'id,ident,type,name,latitude_deg,longitude_deg,iso_country,icao_code,gps_code,local_code';
assert.equal(parseCsv(`${header}\r\n1,BW-1,small_airport,"A, ""B""\nC",-20,23,BW,,,\r\n`)[0].name, 'A, "B"\nC');
assert.throws(() => parseCsv(`${header}\n1,BW-1,small_airport,"oops`), /Unclosed/);
assert.throws(() => parseCsv('id,name\n1,test'), /headers/);
assert.throws(() => mergeOurAirports({}, [row(1, { latitude_deg: '' })], source), /position/);
const snapshot = await readOurAirportsSnapshot();
assert.ok(snapshot.rows.length > 80_000);
assert.equal(snapshot.source.commit, 'b529623d2a0b09a9be78d37fc7a7a5e1e16e3451');
console.log('OurAirports import: identity, collision, FAA, units, exclusions, CSV and snapshot checks passed');
