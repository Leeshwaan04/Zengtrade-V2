#!/usr/bin/env python3
"""Remove the light grey/white card background from the mascot PNGs,
keeping only the subject with a soft, decontaminated edge.

Method: bg-like mask (bright + desaturated) -> keep only the region
connected to the image border (so interior highlights survive) ->
erode 1px to drop the grey AA halo -> feather. Writes RGBA in place,
backing up the opaque originals to *-orig.png once.
"""
import sys, shutil, os
import numpy as np
from PIL import Image, ImageFilter

# bg-like thresholds
T_MIN_BRIGHT = 178   # background min-channel is ~215+, subjects are dark in >=1 channel
T_SAT        = 40    # background max-min is tiny; subjects are saturated

def border_connected(bg):
    """Boolean mask of bg pixels connected to the image border (4-conn),
    via iterative dilation constrained to bg. numpy-only, no scipy."""
    h, w = bg.shape
    reach = np.zeros_like(bg)
    reach[0, :]  |= bg[0, :];  reach[-1, :] |= bg[-1, :]
    reach[:, 0]  |= bg[:, 0];  reach[:, -1] |= bg[:, -1]
    while True:
        nxt = reach.copy()
        nxt[1:, :]  |= reach[:-1, :]
        nxt[:-1, :] |= reach[1:, :]
        nxt[:, 1:]  |= reach[:, :-1]
        nxt[:, :-1] |= reach[:, 1:]
        nxt &= bg
        if nxt.sum() == reach.sum():
            return nxt
        reach = nxt

def process(path):
    orig = path.replace('.png', '-orig.png')
    if not os.path.exists(orig):
        shutil.copy2(path, orig)
    im = Image.open(orig).convert('RGB')
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    minc = np.minimum(np.minimum(r, g), b)
    maxc = np.maximum(np.maximum(r, g), b)
    sat = maxc - minc
    bg_like = (minc > T_MIN_BRIGHT) & (sat < T_SAT)
    border = border_connected(bg_like)       # outer background

    # large bright blobs enclosed by the subject (e.g. the bull's ledge) are
    # also background. Isolate them with a morphological opening so thin/small
    # highlights (teeth, eye glints) are preserved as subject.
    interior = bg_like & ~border
    K = 7  # opening kernel: removes features thinner than ~K px
    intimg = Image.fromarray((interior * 255).astype('uint8'))
    opened = intimg.filter(ImageFilter.MinFilter(K)).filter(ImageFilter.MaxFilter(K))
    big = np.asarray(opened) > 127

    bg = border | big
    subject = ~bg

    # erode subject 1px to remove the grey anti-alias ring, then feather
    subj_img = Image.fromarray((subject * 255).astype('uint8'))
    subj_img = subj_img.filter(ImageFilter.MinFilter(3))      # erode 1px
    alpha = subj_img.filter(ImageFilter.GaussianBlur(1.1))    # soft edge

    out = im.convert('RGBA')
    out.putalpha(alpha)
    out.save(path)
    kept = np.asarray(alpha).astype(np.float32).mean() / 255
    print(f"{os.path.basename(path)}: subject coverage {kept*100:5.1f}%  (bg removed)")

if __name__ == '__main__':
    for p in (sys.argv[1:] or ['mascot-bull.png', 'mascot-bear.png', 'mascot-neutral.png']):
        process(p)
