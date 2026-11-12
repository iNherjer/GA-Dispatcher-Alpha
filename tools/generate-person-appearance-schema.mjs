#!/usr/bin/env node
// Erzeugt data/person-appearance.schema.json aus data/mission-person-vocabulary.json.
// Nach jeder Änderung der Wortliste ausführen.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function buildAppearanceSchema(vocabulary) {
  const keys = (list) => Object.keys(vocabulary[list]);
  const range = (min, max, unit) => ({ type: 'number', exclusiveMinimum: min, exclusiveMaximum: max, description: unit });
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'person-appearance.v1',
    title: 'Steckbrief für Personen-Figuren (VFR Multitool)',
    description: `Erzeugt aus mission-person-vocabulary (${vocabulary.schema}). Eine Datei je SimObject-Ordner, ein Eintrag je Figur bzw. Texturvariante.`,
    type: 'object',
    required: ['schema', 'figures'],
    properties: {
      schema: { const: 'person-appearance.v1' },
      folder: { type: 'string', description: 'SimObject-Ordner, z. B. tw-pod-hikers' },
      figures: {
        type: 'array', minItems: 1,
        items: {
          type: 'object',
          required: ['title', 'workingName', 'gender', 'appearance', 'measured', 'locomotion', 'clips', 'lodCount'],
          properties: {
            title: { type: 'string', pattern: '^(?![Tt][Aa][Rr][Mm][Aa][Cc]_)[A-Za-z0-9][A-Za-z0-9 _.-]{0,159}$', description: 'exakt wie in sim.cfg, nach Release nie ändern' },
            workingName: { type: 'string', minLength: 1 },
            gender: { enum: ['female', 'male'] },
            appearance: {
              type: 'object',
              required: ['look', 'ageBand', 'season', 'props', 'uses', 'description'],
              additionalProperties: false,
              properties: {
                look: { enum: keys('looks') },
                ageBand: { enum: keys('ageBands') },
                season: { enum: keys('seasons') },
                props: { type: 'array', uniqueItems: true, items: { enum: keys('props') } },
                uses: { type: 'array', minItems: 1, uniqueItems: true, items: { enum: keys('uses') } },
                description: { type: 'string', minLength: 1, maxLength: vocabulary.description.maxLength, description: vocabulary.description.rule }
              }
            },
            measured: {
              type: 'object', required: ['heightM', 'footprintRadiusM'],
              properties: { heightM: range(0.5, 2.3, 'Meter'), footprintRadiusM: range(0.1, 1.5, 'Meter, inkl. fester Requisiten') }
            },
            locomotion: {
              type: 'object', required: ['maxWalkKts', 'cleanWalkKts'],
              properties: {
                maxWalkKts: { type: 'number', minimum: 1, maximum: 5 },
                cleanWalkKts: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'number', minimum: 0.5, maximum: 5 } }
              }
            },
            clips: { type: 'array', minItems: 1, items: { type: 'string' } },
            lodCount: { type: 'integer', minimum: 1 },
            knownIssues: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const vocabulary = JSON.parse(fs.readFileSync(path.join(root, 'data/mission-person-vocabulary.json'), 'utf8'));
  fs.writeFileSync(path.join(root, 'data/person-appearance.schema.json'), `${JSON.stringify(buildAppearanceSchema(vocabulary), null, 2)}\n`);
  console.log('data/person-appearance.schema.json erzeugt');
}
