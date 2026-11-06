// Words for traffic warnings: "Achtung, Verkehr, elf Uhr, unterhalb" and
// "Verkehr, ausweichen! Verkehr, ausweichen!". "Achtung", "oberhalb" and
// "unterhalb" already exist (aw-achtung, aw-oberhalb, aw-unterhalb).
// The keys must match the allow list in navigation-warning-audio.js.
const DE_HOURS = ['Ein', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf', 'Zwölf'];
const EN_HOURS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

export const TRAFFIC_WARNING_CLIPS = {
  de: [
    { key: 'aw-verkehr', text: 'Verkehr' },
    { key: 'aw-ausweichen', text: 'Ausweichen!' },
    { key: 'aw-gleiche-hoehe', text: 'Gleiche Höhe' },
    ...DE_HOURS.map((word, i) => ({ key: `aw-uhr-${i + 1}`, text: `${word} Uhr` }))
  ],
  en: [
    { key: 'aw-verkehr', text: 'Traffic' },
    { key: 'aw-ausweichen', text: 'Avoid!' },
    { key: 'aw-gleiche-hoehe', text: 'Same altitude' },
    ...EN_HOURS.map((word, i) => ({ key: `aw-uhr-${i + 1}`, text: `${word} o'clock` }))
  ]
};
