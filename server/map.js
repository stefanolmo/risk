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

const T = (id, name, c, x, y, poly) => ({ id, name, continent: c, x, y, poly });
// poly: contorno su canvas 1000x620. I vertici in comune tra territori confinanti coincidono (confini di terra).
const TERRITORIES = [
  T('ala', 'Alaska', 'na', 68, 92, '20,60 60,38 118,48 118,128 100,142 62,128 30,112 18,88'),
  T('nwt', 'Territori del NO', 'na', 190, 70, '118,48 160,28 255,28 262,72 245,112 180,120 118,128'),
  T('gro', 'Groenlandia', 'na', 340, 62, '290,22 380,20 395,60 360,105 320,100 300,70'),
  T('alb', 'Alberta', 'na', 140, 170, '118,128 180,120 180,212 125,214 98,196 100,142'),
  T('ont', 'Ontario', 'na', 222, 168, '180,120 245,112 270,128 262,205 255,205 205,222 180,212'),
  T('que', 'Quebec', 'na', 300, 150, '270,128 300,95 335,120 330,165 295,185 262,205'),
  T('wus', 'USA Occidentali', 'na', 150, 248, '98,196 125,214 180,212 205,222 205,286 170,300 130,292 108,255 90,225'),
  T('eus', 'USA Orientali', 'na', 250, 250, '205,222 255,205 262,205 295,185 312,215 292,262 258,305 205,286'),
  T('cam', 'America Centrale', 'na', 185, 325, '130,292 170,300 205,286 258,305 245,325 215,335 200,365 178,372 170,345 140,315'),
  T('ven', 'Venezuela', 'sa', 232, 392, '178,372 200,365 262,372 290,392 262,418 215,420 190,398'),
  T('per', 'Perù', 'sa', 232, 455, '190,398 215,420 262,418 268,455 275,500 225,500 205,455 192,430'),
  T('bra', 'Brasile', 'sa', 305, 450, '262,418 290,392 335,415 350,468 315,505 275,500 268,455'),
  T('arg', 'Argentina', 'sa', 265, 550, '225,500 275,500 315,505 290,545 265,600 240,590 232,540'),
  T('isl', 'Islanda', 'eu', 415, 105, '395,95 425,85 440,110 420,125 398,118'),
  T('sca', 'Scandinavia', 'eu', 500, 85, '470,45 515,40 530,90 510,125 480,130 470,100'),
  T('gbr', 'Gran Bretagna', 'eu', 425, 175, '405,150 435,140 450,175 438,200 410,205 398,175'),
  T('neu', 'Europa Settentr.', 'eu', 515, 168, '480,130 510,125 555,150 545,200 490,205 470,185'),
  T('weu', 'Europa Occident.', 'eu', 455, 250, '470,185 490,205 500,260 470,290 430,285 420,250 440,215'),
  T('seu', 'Europa Merid.', 'eu', 525, 245, '490,205 545,200 560,225 555,275 520,291 500,260'),
  T('ukr', 'Ucraina', 'eu', 582, 150, '530,90 570,70 620,95 630,175 600,235 560,225 545,200 555,150 510,125'),
  T('naf', 'Africa del Nord', 'af', 472, 350, '430,285 470,290 520,291 525,350 525,400 470,415 440,390 415,340'),
  T('egy', 'Egitto', 'af', 558, 322, '520,291 555,275 590,300 600,335 560,350 525,350'),
  T('eaf', 'Africa Orientale', 'af', 590, 392, '525,350 560,350 600,335 635,345 640,372 632,415 598,445 555,440 525,400'),
  T('con', 'Congo', 'af', 505, 455, '470,415 525,400 555,440 545,490 500,500 470,470'),
  T('saf', 'Africa del Sud', 'af', 548, 520, '500,500 545,490 555,440 598,445 585,520 545,565 515,555 495,530'),
  T('mad', 'Madagascar', 'af', 638, 505, '625,470 650,480 655,525 635,540 620,510'),
  T('ura', 'Urali', 'as', 665, 138, '620,95 660,70 700,95 700,170 665,200 630,175'),
  T('sib', 'Siberia', 'as', 740, 118, '700,95 735,60 780,70 785,150 745,185 700,170'),
  T('yak', 'Jacuzia', 'as', 810, 62, '735,60 760,30 850,28 880,60 830,95 780,70'),
  T('kam', 'Kamchatka', 'as', 902, 125, '880,60 920,70 950,110 940,170 910,185 870,195 840,160 830,95'),
  T('irk', 'Irkutsk', 'as', 808, 122, '780,70 830,95 840,160 785,150'),
  T('mon', 'Mongolia', 'as', 818, 197, '745,185 785,150 840,160 870,195 840,235 800,230'),
  T('jap', 'Giappone', 'as', 925, 258, '920,215 945,235 935,290 910,300 905,255'),
  T('afg', 'Afghanistan', 'as', 658, 240, '630,175 665,200 705,215 700,265 665,290 620,262 600,235'),
  T('chi', 'Cina', 'as', 760, 248, '700,170 745,185 800,230 815,285 780,330 735,290 700,265 705,215'),
  T('mea', 'Medio Oriente', 'as', 617, 302, '600,235 620,262 665,290 650,340 635,345 600,335 590,300 555,275 560,225'),
  T('ind', 'India', 'as', 692, 345, '665,290 700,265 735,290 725,335 705,395 685,425 665,385 650,340'),
  T('sia', 'Siam', 'as', 765, 358, '735,290 780,330 800,365 780,400 760,380 725,335'),
  T('ido', 'Indonesia', 'oc', 803, 462, '775,450 805,435 830,455 820,485 790,490'),
  T('ngu', 'Nuova Guinea', 'oc', 900, 440, '870,420 920,415 940,445 905,465 870,455'),
  T('wau', 'Australia Occid.', 'oc', 850, 550, '820,520 850,505 880,530 885,580 840,590 815,565'),
  T('eau', 'Australia Orient.', 'oc', 912, 545, '880,530 915,500 945,525 940,572 885,580'),
];

// Collegamenti via mare (disegnati tratteggiati): i confini di terra sono implicati dalle sagome.
const SEA_LINKS = [['ala', 'kam'], ['nwt', 'gro'], ['ont', 'gro'], ['que', 'gro'], ['gro', 'isl'], ['isl', 'sca'], ['isl', 'gbr'],
  ['sca', 'gbr'], ['gbr', 'neu'], ['gbr', 'weu'], ['seu', 'naf'], ['bra', 'naf'], ['eaf', 'mad'], ['saf', 'mad'], ['kam', 'jap'],
  ['mon', 'jap'], ['sia', 'ido'], ['ido', 'ngu'], ['ido', 'wau'], ['ngu', 'wau'], ['ngu', 'eau']];

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

module.exports = { CONTINENTS, TERRITORIES, SEA_LINKS, EDGES, IDS, ADJ };
