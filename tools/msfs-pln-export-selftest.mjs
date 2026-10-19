#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import vm from 'node:vm';

const boardSource = fs.readFileSync(new URL('../board.js', import.meta.url), 'utf8');

function functionSource(source, name) {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `missing function ${name}`);
    const open = source.indexOf(') {', start) + 2;
    assert.ok(open > start, `missing function body ${name}`);
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        if (source[i] === '}') depth -= 1;
        if (depth === 0) return source.slice(start, i + 1);
    }
    throw new Error(`unterminated function ${name}`);
}

const context = {
    console,
    Math,
    Number,
    String,
    Array,
    Object,
    Set,
    Error,
    getMSFSWaypointAltFt: (wp, index, fallbackAlt) => Number(wp?.altFt ?? wp?.elevationFt ?? fallbackAlt)
};
vm.createContext(context);
[
    'escapeMSFSXml',
    'normalizeMSFSIdent',
    'isMSFSAirportIdent',
    'resolveMSFSExportAirportIdent',
    'getMSFSExportAirportRecord',
    'sanitizeMSFSWaypointId',
    'allocateMSFSUniqueIdent',
    '_msfsDms',
    'formatMSFSCoords',
    'formatMSFSElevation',
    'buildMSFSFlightPlanXml'
].forEach(name => vm.runInContext(functionSource(boardSource, name), context, { filename: 'board.js' }));

function build(options) {
    return context.buildMSFSFlightPlanXml({
        cruiseAlt: 4500,
        resolveWaypointAlt: (wp, index, fallbackAlt) => Number(wp?.altFt ?? wp?.elevationFt ?? fallbackAlt),
        ...options
    });
}

function tags(xml, tagName) {
    return Array.from(xml.matchAll(new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'g')), match => match[1]);
}

function waypointBlocks(xml) {
    return Array.from(xml.matchAll(/<ATCWaypoint id="([^"]+)">([\s\S]*?)<\/ATCWaypoint>/g), match => ({
        id: match[1],
        body: match[2]
    }));
}

function assertValidXml(xml, label) {
    const result = spawnSync('xmllint', ['--noout', '-'], { input: xml, encoding: 'utf8' });
    assert.equal(result.status, 0, `${label}: invalid XML: ${result.stderr}`);
}

function assertUnique(values, label) {
    assert.equal(new Set(values.map(value => value.toUpperCase())).size, values.length, label);
}

const directXml = build({
    routeWaypoints: [
        { lat: 48.6899, lng: 9.2219, name: 'Stuttgart', icao: 'EDDS' },
        { lat: 47.6713, lng: 9.5115, name: 'Friedrichshafen', icao: 'EDNY' }
    ],
    departureAirport: true,
    destinationAirport: true,
    departureId: 'EDDS',
    destinationId: 'EDNY',
    depElevation: 1276,
    destinationElevation: 1368,
    departureName: 'Stuttgart',
    destinationName: 'Friedrichshafen',
    planDescr: 'A nach B'
});
assertValidXml(directXml, 'A-B');
assert.match(directXml, /<RouteType>Direct<\/RouteType>/);
assert.match(directXml, /<AppVersionMajor>12<\/AppVersionMajor>/);
assert.deepEqual(waypointBlocks(directXml).map(wp => wp.id), ['EDDS', 'EDNY']);
assert.deepEqual(tags(directXml, 'ATCWaypointType'), ['Airport', 'Airport']);
assert.deepEqual(tags(directXml, 'DestinationName'), ['Friedrichshafen']);

const poiXml = build({
    routeWaypoints: [
        { lat: 48.279167, lng: 8.428333, name: 'EDTW', icao: 'EDTW' },
        { lat: 48.297811, lng: 8.221681, name: 'Hauptstraße', altFt: 4500 },
        { lat: 48.268575, lng: 8.304197, name: 'Return Leg', altFt: 4500 },
        { lat: 48.279167, lng: 8.428333, name: 'Rückkehr EDTW', icao: 'EDTW' }
    ],
    departureAirport: true,
    destinationAirport: true,
    departureId: 'EDTW',
    destinationId: 'EDTW',
    depElevation: 2201,
    destinationElevation: 2310,
    departureName: 'Flugplatz Winzeln-Schramberg',
    destinationName: 'Hauptstraße',
    planDescr: 'TV-Reportage über die Hauptstraße'
});
assertValidXml(poiXml, 'POI round trip');
const poiBlocks = waypointBlocks(poiXml);
assert.deepEqual(poiBlocks.map(wp => wp.id), ['EDTW', 'Hauptstrae', 'ReturnLeg', 'EDTWRTN']);
assertUnique(poiBlocks.map(wp => wp.id), 'POI waypoint ids must be unique');
assert.deepEqual(tags(poiXml, 'ATCWaypointType'), ['Airport', 'User', 'User', 'Airport']);
assert.deepEqual(tags(poiXml, 'DestinationName'), ['Flugplatz Winzeln-Schramberg']);
assert.match(tags(poiXml, 'DestinationLLA')[0], /\+002201\.00$/);
const poiUserIdents = poiBlocks
    .filter(wp => /<ATCWaypointType>User<\/ATCWaypointType>/.test(wp.body))
    .map(wp => tags(wp.body, 'ICAOIdent')[0]);
assert.equal(poiUserIdents.length, 2);
assertUnique(poiUserIdents, 'POI user ICAO idents must be unique');
assert.ok(poiUserIdents.every(ident => ident.length <= 8), 'POI user ICAO idents must be at most 8 characters');

const returnXml = build({
    routeWaypoints: [
        { lat: 48.4252, lng: 10.9317, name: 'Augsburg', icao: 'EDMA' },
        { lat: 47.6713, lng: 9.5115, name: 'Friedrichshafen pickup', icao: 'EDNY', elevationFt: 1368 },
        { lat: 48.4252, lng: 10.9317, name: 'Return Augsburg', icao: 'EDMA' }
    ],
    departureAirport: true,
    destinationAirport: true,
    departureId: 'EDMA',
    destinationId: 'EDMA',
    depElevation: 1515,
    destinationElevation: 1368,
    departureName: 'Augsburg',
    destinationName: 'Friedrichshafen',
    planDescr: 'Pickup und Rückflug'
});
assertValidXml(returnXml, 'A-B-A return');
const returnBlocks = waypointBlocks(returnXml);
assert.deepEqual(returnBlocks.map(wp => wp.id), ['EDMA', 'EDNY', 'EDMARTN']);
assertUnique(returnBlocks.map(wp => wp.id), 'return waypoint ids must be unique');
assert.deepEqual(tags(returnXml, 'ATCWaypointType'), ['Airport', 'Airport', 'Airport']);
assert.deepEqual(tags(returnXml, 'ICAOIdent'), ['EDMA', 'EDNY', 'EDMA']);
assert.deepEqual(tags(returnXml, 'DestinationName'), ['Augsburg']);
assert.match(tags(returnXml, 'DestinationLLA')[0], /\+001515\.00$/);

const database = JSON.parse(fs.readFileSync(new URL('../airports.json', import.meta.url), 'utf8'));
context.getAirportFieldRecord = code => database[code] || null;
assert.equal(context.resolveMSFSExportAirportIdent('OUR-317575', database['OUR-317575']), 'FBHU');
assert.equal(context.resolveMSFSExportAirportIdent('OA-FFACA5FF', database['OA-FFACA5FF']), '', 'Pom Pom must not invent FBNO from its name');
assert.equal(context.resolveMSFSExportAirportIdent('OUR-1'), '', 'short internal keys must not be sanitized into fake ICAOs');
assert.equal(context.resolveMSFSExportAirportIdent('BW-0006'), '');
assert.equal(context.resolveMSFSExportAirportIdent('OUR-1', { iata: 'MUB', aliases: ['FBNO'] }), '', 'IATA/arbitrary aliases are not simulator identity evidence');
assert.equal(context.resolveMSFSExportAirportIdent('OUR-1', { msfsIdent: 'FBNO', icaoCode: 'FBNN' }), 'FBNO');

let download;
Object.assign(context, {
    window: {}, Blob, alert: message => { throw Error(message); },
    document: { getElementById: () => ({ value: '4500' }), createElement: () => ({ click() {} }) },
    URL: { createObjectURL: blob => { download = blob; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout: callback => callback(), closeTransferModal() {},
    missionMSFSUsesSarHeliCustomDestination: () => false,
    currentMissionData: { mission: 'Test Hunda', departureAirport: { ident: 'OUR-317575', altIdentifier: 'FBHU' } },
    currentStartICAO: 'OUR-317575', currentDestICAO: 'FBMN', currentDepElev: 3150, currentDestElev: 3093,
    currentSName: 'Hunda Airport', currentDName: 'Maun',
    routeWaypoints: [
        { lat: -19.4, lng: 22.7, name: 'Hunda', icao: 'OUR-317575' },
        { lat: -19.5, lng: 22.8, name: 'Hunda pickup', icao: 'OUR-317575' },
        { lat: -19.97, lng: 23.43, name: 'Maun', icao: 'FBMN' }
    ]
});
const exportStart = boardSource.indexOf('window.exportMSFS = function()');
const exportEnd = boardSource.indexOf('\n};', exportStart) + 3;
vm.runInContext(boardSource.slice(exportStart, exportEnd), context);
context.window.exportMSFS();
const gpsXml = await download.text();
assertValidXml(gpsXml, 'GPS alias export');
assert.deepEqual(tags(gpsXml, 'DepartureID'), ['FBHU']);
assert.deepEqual(tags(gpsXml, 'ICAOIdent'), ['FBHU', 'FBHU', 'FBMN']);
assert.deepEqual(tags(gpsXml, 'ATCWaypointType'), ['Airport', 'Airport', 'Airport']);
assert.equal(context.currentStartICAO, 'OUR-317575', 'export must not mutate mission identity');

context.getAirportFieldRecord = () => null;
context.window.exportMSFS();
assert.deepEqual(tags(await download.text(), 'DepartureID'), ['FBHU'], 'restored mission metadata must resolve without loaded catalog');
context.currentMissionData.departureAirport = null;
context.currentStartICAO = 'OA-FFACA5FF';
context.window.exportMSFS();
const customXml = await download.text();
assertValidXml(customXml, 'unknown simulator ident');
assert.equal(tags(customXml, 'ATCWaypointType')[0], 'User');
assert.match(tags(customXml, 'DepartureLLA')[0], /^S19/);
assert.ok(!tags(customXml, 'ICAOIdent').includes('FBNO'));
context.missionMSFSUsesSarHeliCustomDestination = () => true;
context.window.exportMSFS();
assert.equal(tags(await download.text(), 'ATCWaypointType').at(-1), 'User', 'SAR heli custom endpoint must remain a coordinate waypoint');

console.log('MSFS PLN export self-test passed (A-B, POI, A-B-A, real GPS aliases, restored metadata, unknown IDs and SAR heli).');
