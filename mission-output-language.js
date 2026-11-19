/* Output language of generated mission text (phase 4 of the English translation).
   German UI: prompts stay exactly as written. English UI: writers on the idea path append an
   English output directive; the prompts themselves, their checks and fixed values stay as they are. */
(function(root){
'use strict';
const DIRECTIVE='\n\nOUTPUT LANGUAGE: English. Write every text that the pilot or passengers read or hear '
 +'(titles, stories, briefings, greetings, card texts, notes, memories, spoken lines) in natural, idiomatic English, '
 +'even though these instructions are written in German. Keep JSON keys, IDs, numbers, units and fixed-choice values '
 +'exactly as the instructions specify them, including German ones such as niedrig|mittel|hoch. '
 +'Keep place names, airfield names and ICAO codes as they are.';
function language(){const g=root.GAI18n;return g&&typeof g.getLanguage==='function'&&g.getLanguage()==='en'?'en':'de';}
function directive(){return language()==='en'?DIRECTIVE:'';}
function wrap(prompt){return typeof prompt==='string'?prompt+directive():prompt;}
const api={DIRECTIVE,language,directive,wrap};
root.MissionOutputLanguage=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
