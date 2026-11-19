/* Cargo asset kinds: a language-independent name for the main shipment piece. Writers and idea
   cores may name one; the boarding scene (sync.js) picks the ground object from it and falls back
   to its word search on the cargo text. Order and names match _missionSceneCargoAssetForKind. */
(function(root){
'use strict';
const KINDS=Object.freeze(['logbook','fire_extinguisher','first_aid_case','wheel_chocks','mail','cooler','animal_box',
 'medical_kit','jerrycan','tool_cart','toolbox','camera_backpack','camping','camera_gear',
 'hard_case','duffel','suitcase','daypack','backpack','personal_luggage','wood_crate']);
function clean(value){const kind=typeof value==='string'?value.trim().toLowerCase():'';return KINDS.includes(kind)?kind:'';}
function promptLine(field='shipment.assetKind'){return `${field} benennt die Art des Hauptstücks für das Bodenobjekt mit genau einem Wert aus: ${KINDS.join(', ')}. Passt keiner, lass ${field} weg.`;}
const api={KINDS,clean,promptLine};
root.MissionCargoAssetKinds=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
