'use strict';

const { gunzip } = require('node:zlib');
const { promisify } = require('node:util');
const { createDwdWeatherReader } = require('../dwd-weather-assets');

const DWD_ROOT = 'https://ga-dwd-alpha.einherjer.workers.dev';
const HOUR = 3600000;
const decompress = promisify(gunzip);

async function readBytes(response, limit) {
  const stream = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await stream.read();
      if (done) return Buffer.concat(chunks, length);
      length += value.byteLength;
      if (length > limit) throw new Error('dwd_asset_too_large');
      chunks.push(value);
    }
  } catch (error) {
    await stream.cancel().catch(() => {});
    throw error;
  } finally { stream.releaseLock(); }
}

async function readManifest(response) {
  const data = JSON.parse((await readBytes(response, 32 * 1024)).toString('utf8'));
  const { bounds, tileDegrees, samplesPerDegree, levels, terms, fields } = data;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isInteger) ||
      bounds[0] < -90 || bounds[2] > 90 || bounds[1] < -180 || bounds[3] > 180 ||
      bounds[2] <= bounds[0] || bounds[3] <= bounds[1] ||
      !Number.isInteger(tileDegrees) || tileDegrees < 1 || !Number.isInteger(samplesPerDegree) || samplesPerDegree < 1 ||
      tileDegrees * samplesPerDegree > 32 || !Array.isArray(levels) || levels.length > 24 ||
      !Array.isArray(terms) || terms.length > 48 || terms.some(term =>
        !/^\d{10}-\d{10}$/.test(term?.key) || !Number.isSafeInteger(term.validAt) || !Number.isSafeInteger(term.runAt)) ||
      !data.encoding || ![fields?.map, fields?.profile].every(columns => Array.isArray(columns) && columns.length > 0 && columns.length <= 96)) {
    throw new Error('dwd_invalid_manifest');
  }
  return data;
}

function createTrackerDwdWeather(fetchRemote = fetch) {
  const weather = createDwdWeatherReader({
    root: DWD_ROOT,
    fetchAssetResponse: (url, options) => fetchRemote(url, { ...options, redirect: 'error' }),
    timeoutMs: 6000,
    tileLimit: 12,
    readManifest,
    async decodeTile(response, size) {
      const bytes = await decompress(await readBytes(response, 128 * 1024), { maxOutputLength: size });
      return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
  });
  setInterval(weather.pruneTiles, 60000).unref();
  return async function query({ points, profile, validAt, probe }, signal) {
    if (probe) {
      const data = await weather.manifest();
      const hour = Math.floor(Date.now() / HOUR) * HOUR;
      return { source: 'dwd-icon-eu', available: data.terms.some(term => term.validAt >= hour - 2 * HOUR && term.validAt <= hour), samples: [null] };
    }
    const samples = await weather.read(points, { signal, includePressure: profile, validAt });
    const current = samples.find(Boolean);
    return { source: 'dwd-icon-eu', runAt: current?.modelRunAt ?? null, validAt: current?.contourValidAt ?? null, samples };
  };
}

module.exports = { createTrackerDwdWeather };
