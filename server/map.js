'use strict';
// Mappa classica: 42 territori, 6 continenti. x,y su canvas 1000x620.
const CONTINENTS = [
  { id: 'na', name: 'Nord America', bonus: 5, color: '#c9a227' },
  { id: 'sa', name: 'Sud America', bonus: 2, color: '#c0552e' },
  { id: 'eu', name: 'Europa', bonus: 5, color: '#3b6fb5' },
  { id: 'af', name: 'Africa', bonus: 3, color: '#a0703a' },
  { id: 'as', name: 'Asia', bonus: 7, color: '#3e9a5b' },
  { id: 'oc', name: 'Oceania', bonus: 2, color: '#8e5bb0' },
];

const T = (id, name, c, x, y) => ({ id, name, continent: c, x, y });
const TERRITORIES = [
  T('ala', 'Alaska', 'na', 60, 90), T('nwt', 'Territori del NO', 'na', 150, 80),
  T('gro', 'Groenlandia', 'na', 330, 50), T('alb', 'Alberta', 'na', 140, 150),
  T('ont', 'Ontario', 'na', 215, 160), T('que', 'Quebec', 'na', 285, 150),
  T('wus', 'USA Occidentali', 'na', 150, 225), T('eus', 'USA Orientali', 'na', 225, 235),
  T('cam', 'America Centrale', 'na', 170, 310),
  T('ven', 'Venezuela', 'sa', 240, 380), T('per', 'Perù', 'sa', 240, 450),
  T('bra', 'Brasile', 'sa', 310, 430), T('arg', 'Argentina', 'sa', 260, 530),
  T('isl', 'Islanda', 'eu', 400, 100), T('sca', 'Scandinavia', 'eu', 480, 90),
  T('gbr', 'Gran Bretagna', 'eu', 410, 170), T('neu', 'Europa Settentr.', 'eu', 480, 175),
  T('weu', 'Europa Occident.', 'eu', 420, 245), T('seu', 'Europa Merid.', 'eu', 500, 250),
  T('ukr', 'Ucraina', 'eu', 570, 150),
  T('naf', 'Africa del Nord', 'af', 440, 340), T('egy', 'Egitto', 'af', 520, 320),
  T('eaf', 'Africa Orientale', 'af', 565, 385), T('con', 'Congo', 'af', 520, 440),
  T('saf', 'Africa del Sud', 'af', 525, 520), T('mad', 'Madagascar', 'af', 610, 500),
  T('ura', 'Urali', 'as', 660, 120), T('sib', 'Siberia', 'as', 730, 80),
  T('yak', 'Jacuzia', 'as', 800, 60), T('kam', 'Kamchatka', 'as', 880, 90),
  T('irk', 'Irkutsk', 'as', 790, 135), T('mon', 'Mongolia', 'as', 800, 200),
  T('jap', 'Giappone', 'as', 900, 200), T('afg', 'Afghanistan', 'as', 650, 215),
  T('chi', 'Cina', 'as', 750, 270), T('mea', 'Medio Oriente', 'as', 600, 300),
  T('ind', 'India', 'as', 690, 320), T('sia', 'Siam', 'as', 770, 350),
  T('ido', 'Indonesia', 'oc', 790, 440), T('ngu', 'Nuova Guinea', 'oc', 880, 420),
  T('wau', 'Australia Occid.', 'oc', 820, 520), T('eau', 'Australia Orient.', 'oc', 900, 510),
];

const EDGES = `ala-nwt ala-alb ala-kam nwt-alb nwt-ont nwt-gro gro-ont gro-que gro-isl alb-ont alb-wus
ont-que ont-wus ont-eus que-eus wus-eus wus-cam eus-cam cam-ven ven-per ven-bra per-bra per-arg bra-arg
bra-naf isl-sca isl-gbr sca-gbr sca-neu sca-ukr gbr-neu gbr-weu neu-weu neu-seu neu-ukr weu-seu weu-naf
seu-ukr seu-mea seu-egy seu-naf ukr-ura ukr-afg ukr-mea naf-egy naf-eaf naf-con egy-mea egy-eaf eaf-con
eaf-saf eaf-mad eaf-mea con-saf saf-mad ura-sib ura-afg ura-chi sib-yak sib-irk sib-mon sib-chi yak-irk
yak-kam kam-irk kam-mon kam-jap irk-mon mon-jap mon-chi afg-chi afg-ind afg-mea chi-ind chi-sia mea-ind
ind-sia sia-ido ido-ngu ido-wau ngu-wau ngu-eau wau-eau`.split(/\s+/).map((e) => e.split('-'));

const IDS = TERRITORIES.map((t) => t.id);
const ADJ = {};
IDS.forEach((i) => (ADJ[i] = []));
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }
CONTINENTS.forEach((c) => (c.terrs = TERRITORIES.filter((t) => t.continent === c.id).map((t) => t.id)));

module.exports = { CONTINENTS, TERRITORIES, EDGES, IDS, ADJ };
