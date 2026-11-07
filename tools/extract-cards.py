#!/usr/bin/env python3
"""Estrae la grafica originale delle carte dai PDF "Risk_Territory_Card" e "Risk_Mission_Card"
(pagina 1 esclusa: serve solo per piegare le carte) e scrive gli asset in public/cards/:
  card-bg.jpg   sfondo comune (pergamena + cornice + raggi), senza figure
  sym-*.png     simboli fante / cavaliere / cannone (trasparenti)
  crest.png     stemma rosso della carta missione (senza la scritta)
Uso: python3 tools/extract-cards.py Risk_Territory_Card.pdf Risk_Mission_Card.pdf
Richiede poppler (pdftoppm) e Pillow + numpy."""
import glob, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image

terr_pdf, miss_pdf = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(__file__), '..', 'public', 'cards')
os.makedirs(out, exist_ok=True)
tmp = tempfile.mkdtemp()
subprocess.check_call(['pdftoppm', '-r', '300', '-f', '2', '-png', terr_pdf, tmp + '/t'])
subprocess.check_call(['pdftoppm', '-r', '300', '-f', '2', '-png', miss_pdf, tmp + '/m'])

W, H = 670, 1046                      # facce: 4 per pagina (le altre 4 celle sono i dorsi)
OFFS = [(402, 188), (1756, 188), (402, 1239), (1756, 1239)]
def faces(pattern):
    for f in sorted(glob.glob(pattern)):
        im = Image.open(f).convert('RGB')
        for x, y in OFFS: yield np.array(im.crop((x, y, x + W, y + H)))
tf, mf = list(faces(tmp + '/t-*.png')), list(faces(tmp + '/m-*.png'))
assert len(tf) == 44 and len(mf) == 12, (len(tf), len(mf))

# sfondo: per ogni pixel la faccia più chiara -> spariscono tutte le figure, restano cornice e raggi (uguali su tutte)
st = np.stack(tf + mf).astype(np.float32)
lum = st[..., 0] * .299 + st[..., 1] * .587 + st[..., 2] * .114
blank = np.take_along_axis(st, lum.argmax(0)[None, :, :, None], 0)[0].astype(np.uint8)
for off in (136,):                    # ripara un difetto sul bordo alto copiando un tratto identico (periodo 68px)
    blank[48:76, 350:402] = blank[48:76, 350 - off:402 - off]
Image.fromarray(blank).resize((W * 2 // 3, H * 2 // 3), Image.LANCZOS).save(out + '/card-bg.jpg', quality=82)
blum = blank.astype(np.float32) @ np.array([.299, .587, .114], np.float32)

def cutout(face, box, color, lo, hi, clear=None):
    """figura trasparente: opacità = quanto il pixel è più scuro dello sfondo pulito"""
    l = face.astype(np.float32) @ np.array([.299, .587, .114], np.float32)
    a = np.clip((blum - l - lo) / (hi - lo), 0, 1)
    x0, y0, x1, y1 = box
    m = np.zeros_like(a); m[y0:y1, x0:x1] = 1
    if clear:
        cx0, cy0, cx1, cy1 = clear; m[cy0:cy1, cx0:cx1] = 0
    a *= m
    rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = color; rgba[..., 3] = (a * 255).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA'); box = im.getchannel('A').getbbox(); im = im.crop(box)
    return im.resize((im.width * 6 // 10, im.height * 6 // 10), Image.LANCZOS), list(box)

joker = tf[0]                          # carta jolly: i tre simboli isolati
INK = (27, 24, 22)
LAYOUT = {}  # posizione (x0,y0,x1,y1) di ogni figura sulla carta originale 670x1046
for name, args, kw in [('cannone', ((225, 80, 590, 280), INK, 40, 110), {}), ('fante', ((90, 282, 310, 625), INK, 40, 110), {}),
                       ('cavaliere', ((215, 555, 600, 960), INK, 40, 110), dict(clear=(215, 555, 312, 645)))]:
    im, LAYOUT[name] = cutout(joker, *args, **kw); im.save(out + '/sym-%s.png' % name)
# stemma della carta missione (la scritta MISSION viene tolta: nel gioco si scrive in italiano).
# Il rosso si isola dalla differenza R-G (pergamena ~20, rosso ~160): niente tracce dei raggi sotto la figura.
f = mf[0].astype(np.float32)
a = np.clip((f[..., 0] - f[..., 1] - 55) / 70, 0, 1)
m = np.zeros_like(a); m[30:400, 195:490] = 1; m[326:368, 228:440] = 0
rgba = np.zeros((H, W, 4), np.uint8); rgba[..., :3] = (190, 30, 46); rgba[..., 3] = (a * m * 255).astype(np.uint8)
im = Image.fromarray(rgba, 'RGBA'); im = im.crop(im.getchannel('A').getbbox())
im2 = Image.fromarray(rgba, 'RGBA'); LAYOUT['crest'] = list(im2.getchannel('A').getbbox())
im.resize((im.width * 6 // 10, im.height * 6 // 10), Image.LANCZOS).save(out + '/crest.png')
import json; json.dump(LAYOUT, open(out + '/layout.json', 'w'))
print('ok', os.listdir(out))
