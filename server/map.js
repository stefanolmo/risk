'use strict';
// Mappa classica: 42 territori, 6 continenti. x,y su canvas 1000x620.
const CONTINENTS = [
  { id: 'na', name: 'Nord America', bonus: 5, color: '#e3c350' },
  { id: 'sa', name: 'Sud America', bonus: 2, color: '#cf5a45' },
  { id: 'eu', name: 'Europa', bonus: 5, color: '#4f86c6' },
  { id: 'af', name: 'Africa', bonus: 3, color: '#dd9440' },
  { id: 'as', name: 'Asia', bonus: 7, color: '#62ad62' },
  { id: 'oc', name: 'Oceania', bonus: 2, color: '#a274c0' },
];

const T = (id, name, c) => ({ id, name, continent: c });
const TERRITORIES = [
  T('ala', 'Alaska', 'na'),
  T('nwt', 'Territori del NO', 'na'),
  T('gro', 'Groenlandia', 'na'),
  T('alb', 'Alberta', 'na'),
  T('ont', 'Ontario', 'na'),
  T('que', 'Quebec', 'na'),
  T('wus', 'USA Occidentali', 'na'),
  T('eus', 'USA Orientali', 'na'),
  T('cam', 'America Centrale', 'na'),
  T('ven', 'Venezuela', 'sa'),
  T('per', 'Perù', 'sa'),
  T('bra', 'Brasile', 'sa'),
  T('arg', 'Argentina', 'sa'),
  T('isl', 'Islanda', 'eu'),
  T('sca', 'Scandinavia', 'eu'),
  T('gbr', 'Gran Bretagna', 'eu'),
  T('neu', 'Europa Settentr.', 'eu'),
  T('weu', 'Europa Occident.', 'eu'),
  T('seu', 'Europa Merid.', 'eu'),
  T('ukr', 'Ucraina', 'eu'),
  T('naf', 'Africa del Nord', 'af'),
  T('egy', 'Egitto', 'af'),
  T('eaf', 'Africa Orientale', 'af'),
  T('con', 'Congo', 'af'),
  T('saf', 'Africa del Sud', 'af'),
  T('mad', 'Madagascar', 'af'),
  T('ura', 'Urali', 'as'),
  T('sib', 'Siberia', 'as'),
  T('yak', 'Jacuzia', 'as'),
  T('kam', 'Kamchatka', 'as'),
  T('irk', 'Irkutsk', 'as'),
  T('mon', 'Mongolia', 'as'),
  T('jap', 'Giappone', 'as'),
  T('afg', 'Afghanistan', 'as'),
  T('chi', 'Cina', 'as'),
  T('mea', 'Medio Oriente', 'as'),
  T('ind', 'India', 'as'),
  T('sia', 'Siam', 'as'),
  T('ido', 'Indonesia', 'oc'),
  T('ngu', 'Nuova Guinea', 'oc'),
  T('wau', 'Australia Occid.', 'oc'),
  T('eau', 'Australia Orient.', 'oc'),
];

const EDGES = `ala-nwt ala-alb ala-kam nwt-alb nwt-ont nwt-gro gro-ont gro-que gro-isl alb-ont alb-wus
ont-que ont-wus ont-eus que-eus wus-eus wus-cam eus-cam cam-ven ven-per ven-bra per-bra per-arg bra-arg
bra-naf isl-sca isl-gbr sca-gbr sca-neu sca-ukr gbr-neu gbr-weu neu-weu neu-seu neu-ukr weu-seu weu-naf
seu-ukr seu-mea seu-egy seu-naf ukr-ura ukr-afg ukr-mea naf-egy naf-eaf naf-con egy-mea egy-eaf eaf-con
eaf-saf eaf-mad eaf-mea con-saf saf-mad ura-sib ura-afg ura-chi sib-yak sib-irk sib-mon sib-chi yak-irk
yak-kam kam-irk kam-mon kam-jap irk-mon mon-jap mon-chi afg-chi afg-ind afg-mea chi-ind chi-sia mea-ind
ind-sia sia-ido ido-ngu ido-wau ngu-wau ngu-eau wau-eau`.split(/\s+/).map((e) => e.split('-'));

// Contorni e posizione delle pedine, generati da tools/build-map.js dalla mappa SVG del tabellone.
let SHAPES = null;
try { SHAPES = require('./shapes.json'); } catch { /* assente solo durante la prima generazione */ }
if (SHAPES) TERRITORIES.forEach((t) => Object.assign(t, SHAPES.terr[t.id]));

// Nomi estesi (le etichette della mappa sono abbreviate), usati sulle carte.
const FULL = { nwt: 'Territori del Nord Ovest', neu: 'Europa Settentrionale', weu: 'Europa Occidentale', seu: 'Europa Meridionale',
  wus: 'Stati Uniti Occidentali', eus: 'Stati Uniti Orientali', wau: 'Australia Occidentale', eau: 'Australia Orientale' };
TERRITORIES.forEach((t) => { t.full = FULL[t.id] || t.name; });

const IDS = TERRITORIES.map((t) => t.id);
const ADJ = {};
IDS.forEach((i) => (ADJ[i] = []));
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
CONTINENTS.forEach((c) => (c.terrs = TERRITORIES.filter((t) => t.continent === c.id).map((t) => t.id)));

module.exports = { CONTINENTS, TERRITORIES, SHAPES, EDGES, IDS, ADJ };
