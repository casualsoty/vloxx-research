// Reads a screenshot of the in-game squad panel (grid view: one green tile per player, name on top, white specialisation icon below).
// 1. finds the green tiles, 2. groups them into rows (row = subgroup, top to bottom), 3. cuts the white icon out of each tile and compares
// it with the 45 official icons (window.GREENS.icons, docs-src/spec_icons.json), 4. reads the name on each tile with a text reader (as far as
// the panel shows it: long names are cut). Everything runs in the browser.
(function () {
  const N = 20;   // icons are compared on an N x N grid
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('not an image')); i.src = src; });
  // any drawable → N x N brightness vector, keeping the aspect ratio, centred
  function grid(src, sx, sy, sw, sh) { const c = mk(N, N), x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, N, N); const k = Math.min(N / sw, N / sh), w = sw * k, h = sh * k; x.imageSmoothingQuality = 'high';
    x.drawImage(src, sx, sy, sw, sh, (N - w) / 2, (N - h) / 2, w, h); const d = x.getImageData(0, 0, N, N).data, v = new Float32Array(N * N); for (let i = 0; i < N * N; i++) v[i] = d[i * 4]; return v; }
  function ncc(a, b) { let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length; let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; s += x * y; sa += x * x; sb += y * y; } return sa && sb ? s / Math.sqrt(sa * sb) : 0; }
  // white icon on black, cropped to its bounding box
  function whiteBox(c, thr = 100) { const x = c.getContext('2d', { willReadFrequently: true }), d = x.getImageData(0, 0, c.width, c.height).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < c.height; y++) for (let X = 0; X < c.width; X++) if (d[(y * c.width + X) * 4] > thr) { if (X < x0) x0 = X; if (X > x1) x1 = X; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; }
  // the name: upper half of the tile as dark text on white, enlarged 4x (what the text reader wants). The tile's edge is left out.
  function nameImage(cx, t) { const K = 4, x = Math.round(t.x + t.w * 0.04), w = Math.round(t.w * 0.92), y = Math.round(t.top + t.h * 0.06), h = Math.round(t.h * 0.46); if (w < 8 || h < 5 || y < 0) return null;
    const d = cx.getImageData(x, y, w, h), mn = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) mn[i] = Math.min(d.data[i * 4], d.data[i * 4 + 1], d.data[i * 4 + 2]); const so = mn.slice().sort(), bg = so[so.length >> 1], mx = so[Math.floor(so.length * 0.98)]; if (mx - bg < 40) return null;
    for (let i = 0; i < w * h; i++) { const v = 255 - Math.max(0, Math.min(255, (mn[i] - bg) / (mx - bg) * 255)); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    const s = mk(w, h); s.getContext('2d').putImageData(d, 0, 0); const c = mk((w + 6) * K, (h + 6) * K), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingQuality = 'high'; g.drawImage(s, 0, 0, w, h, 3 * K, 3 * K, w * K, h * K); return c; }
  // (after reading: names start with a capital, so a leading "l" is turned into an "I")
  // names are read with Tesseract.js, loaded from a CDN only when a screenshot is imported; the recognition itself runs in the browser
  // A squad-role symbol (lieutenant chevron, commander tag) sits before the name and is not part of it. The text reader sees it as a lone
  // character it is unsure about ("Y", "v", "¥"): a first word of one or two characters read with low confidence is dropped.
  const ROLE_CONF = 88;
  const OCR_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  async function readNames(tiles) { if (!window.Tesseract) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = OCR_SRC; sc.onload = ok; sc.onerror = () => no(new Error('text reader not reachable')); document.head.appendChild(sc); });
    const w = await window.Tesseract.createWorker('eng+deu+fra+spa'); await w.setParameters({ tessedit_pageseg_mode: '7' }); const out = [];
    try { for (const t of tiles) { if (!t.nameImg) { out.push(''); continue; } const r = await w.recognize(t.nameImg), ws = (r.data.words || []).slice(); while (ws.length > 1 && ws[0].text.replace(/[^\p{L}\p{N}]/gu, '').length <= 2 && ws[0].confidence < ROLE_CONF) ws.shift();
        const txt = (r.data.words && r.data.words.length ? ws.map(x => x.text).join(' ') : r.data.text).replace(/\s+/g, ' ').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, '').trim().replace(/^l/, 'I').replace(/^IL(?=\p{Ll})/u, 'Il'); const conf = ws.length ? ws.reduce((a, x) => a + x.confidence, 0) / ws.length : r.data.confidence; out.push(conf >= 55 && txt.length >= 2 ? txt.slice(0, 40) : ''); } } finally { await w.terminate(); }
    return out; }
  let TPL = null;
  async function templates() { if (TPL) return TPL; const out = []; for (const [name, uri] of Object.entries((window.GREENS || {}).icons || {})) { const im = await loadImg(uri), c = mk(im.width, im.height), x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
      // some official icons have faint grey parts (the Vindicator's wings) that the game shows much dimmer than the rest: each icon is kept in
      // three versions, cut at a low, medium and high brightness, and the best of the three counts
      const d = x.getImageData(0, 0, c.width, c.height); for (const thr of [60, 120, 170]) { const v = mk(c.width, c.height), vx = v.getContext('2d', { willReadFrequently: true }), o = vx.createImageData(c.width, c.height);
        for (let i = 0; i < c.width * c.height; i++) { const l = d.data[i * 4] > thr ? Math.min(255, d.data[i * 4] * 1.5) : 0; o.data[i * 4] = o.data[i * 4 + 1] = o.data[i * 4 + 2] = l; o.data[i * 4 + 3] = 255; } vx.putImageData(o, 0, 0);
        const b = whiteBox(v, 1); if (b && b.w > 3 && b.h > 3) out.push({ name, c: v, b }); } } return TPL = out; }
  async function read(source) { const im = typeof source === 'string' ? await loadImg(source) : source, W = im.naturalWidth || im.width, H = im.naturalHeight || im.height; if (!W || W * H > 4e7) throw new Error('image too large');
    const cv = mk(W, H), cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0); const D = cx.getImageData(0, 0, W, H).data;
    // 1. green tiles: connected areas of green pixels
    const green = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) { const r = D[i * 4], g = D[i * 4 + 1], b = D[i * 4 + 2]; green[i] = g > 45 && g > r * 1.2 && g > b * 1.2 ? 1 : 0; }
    const boxes = [], stack = []; for (let s = 0; s < W * H; s++) { if (green[s] !== 1) continue; let x0 = W, y0 = H, x1 = 0, y1 = 0, n = 0; stack.push(s); green[s] = 2;
      while (stack.length) { const p = stack.pop(), x = p % W, y = (p / W) | 0; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && green[p - 1] === 1) { green[p - 1] = 2; stack.push(p - 1); } if (x < W - 1 && green[p + 1] === 1) { green[p + 1] = 2; stack.push(p + 1); } if (y > 0 && green[p - W] === 1) { green[p - W] = 2; stack.push(p - W); } if (y < H - 1 && green[p + W] === 1) { green[p + W] = 2; stack.push(p + W); } }
      const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w >= 24 && h >= 8 && w > h && w < h * 8 && n > w * h * 0.35) boxes.push({ x: x0, y: y0, w, h }); }
    if (!boxes.length) return [];
    const med = a => a.slice().sort((p, q) => p - q)[a.length >> 1], mw = med(boxes.map(b => b.w)), tall = boxes.filter(b => b.w > mw * 0.7 && b.w < mw * 1.4), mh = med(tall.map(b => b.h));
    const tiles = tall.filter(b => b.h > mh * 0.35 && b.h < mh * 1.4).map(b => ({ x: b.x, w: b.w, bottom: b.y + b.h, top: b.y + b.h - Math.max(b.h, mh), h: Math.max(b.h, mh) }));   // a tile partly covered (tooltip over the name) keeps its bottom
    // 2. rows = subgroups
    tiles.sort((a, b) => a.bottom - b.bottom); const rows = []; for (const t of tiles) { const r = rows[rows.length - 1]; if (r && Math.abs(r[0].bottom - t.bottom) < mh * 0.5) r.push(t); else rows.push([t]); }
    rows.forEach(r => r.sort((a, b) => a.x - b.x));
    // 3. the icon: white pixels in the lower part of the tile
    const T = await templates(), out = [];
    for (let ri = 0; ri < rows.length; ri++) for (const t of rows[ri]) { const ax = Math.round(t.x + t.w * 0.2), aw = Math.round(t.w * 0.6), ay = Math.max(0, Math.round(t.top + t.h * 0.3)), ah = Math.round(t.bottom - t.h * 0.03) - ay; if (aw < 4 || ah < 4) continue;
      const ic = mk(aw, ah), ix = ic.getContext('2d', { willReadFrequently: true }), src = cx.getImageData(ax, ay, aw, ah), o = ix.createImageData(aw, ah);
      // "white" is relative to this tile: between its green background (median) and its brightest pixels, so dimmed or outlined icons still read
      const mn = new Uint8Array(aw * ah); for (let i = 0; i < aw * ah; i++) mn[i] = Math.min(src.data[i * 4], src.data[i * 4 + 1], src.data[i * 4 + 2]); const so = mn.slice().sort(), bg = so[so.length >> 1], mx = so[Math.floor(so.length * 0.985)], lo = bg + (mx - bg) * 0.35, hi = bg + (mx - bg) * 0.7;
      for (let i = 0; i < aw * ah; i++) { const v = mx - bg < 40 ? 0 : Math.max(0, Math.min(255, (mn[i] - lo) / (hi - lo) * 255)); o.data[i * 4] = o.data[i * 4 + 1] = o.data[i * 4 + 2] = v; o.data[i * 4 + 3] = 255; }
      // the search area starts high enough for tall icons, so it can also catch the bottom of the name: keep only the icon, i.e. the biggest
      // white shape centred in the lower part of the tile plus the shapes right next to it; anything hanging from the top edge is text
      { const lab = new Int32Array(aw * ah), comps = [], q = []; for (let s0 = 0; s0 < aw * ah; s0++) { if (o.data[s0 * 4] <= 100 || lab[s0]) continue; const c = { id: comps.length + 1, n: 0, x0: aw, y0: ah, x1: 0, y1: 0, sy: 0 }; comps.push(c); lab[s0] = c.id; q.push(s0);
          while (q.length) { const p = q.pop(), x = p % aw, y = (p / aw) | 0; c.n++; c.sy += y; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= aw || Y >= ah) continue; const k = Y * aw + X; if (!lab[k] && o.data[k * 4] > 100) { lab[k] = c.id; q.push(k); } } } }
        const yIn = y => (ay + y - t.top) / t.h, main = comps.filter(c => yIn(c.sy / c.n) >= 0.5).sort((a, b) => b.n - a.n)[0], keep = new Set(), gap = Math.max(2, Math.round(t.h * 0.06));
        if (main) { keep.add(main.id); const bx = { x0: main.x0, y0: main.y0, x1: main.x1, y1: main.y1 }; let grew = true; while (grew) { grew = false; for (const c of comps) { if (keep.has(c.id) || (c.y0 === 0 && yIn(c.sy / c.n) < 0.45)) continue;
              if (c.x0 <= bx.x1 + gap && c.x1 >= bx.x0 - gap && c.y0 <= bx.y1 + gap && c.y1 >= bx.y0 - gap) { keep.add(c.id); bx.x0 = Math.min(bx.x0, c.x0); bx.y0 = Math.min(bx.y0, c.y0); bx.x1 = Math.max(bx.x1, c.x1); bx.y1 = Math.max(bx.y1, c.y1); grew = true; } } } }
        for (let i = 0; i < aw * ah; i++) if (!keep.has(lab[i])) o.data[i * 4] = o.data[i * 4 + 1] = o.data[i * 4 + 2] = 0; }
      ix.putImageData(o, 0, 0);
      const b = whiteBox(ic), rec = { sub: Math.min(5, ri + 1), spec: '', score: 0, margin: 0, second: '', crop: '' }; out.push(rec);
      const cc = mk(t.w, t.h); cc.getContext('2d').drawImage(cv, t.x, t.top, t.w, t.h, 0, 0, t.w, t.h); rec.crop = cc.toDataURL(); rec.nameImg = nameImage(cx, t); if (!b || b.w < 4 || b.h < 4) continue;
      const v = grid(ic, b.x, b.y, b.w, b.h), sc = [];
      for (const tp of T) { const s = mk(b.w, b.h), sx = s.getContext('2d'); sx.fillStyle = '#000'; sx.fillRect(0, 0, b.w, b.h); sx.imageSmoothingQuality = 'high'; sx.drawImage(tp.c, tp.b.x, tp.b.y, tp.b.w, tp.b.h, 0, 0, b.w, b.h);   // the official icon, blurred down to the size it has in the screenshot
        sc.push([ncc(v, grid(s, 0, 0, b.w, b.h)) - 0.5 * Math.abs(Math.log((tp.b.w / tp.b.h) / (b.w / b.h))), tp.name]); }
      sc.sort((p, q) => q[0] - p[0]); const other = sc.find(x => x[1] !== sc[0][1]); rec.spec = sc[0][1]; rec.score = +sc[0][0].toFixed(3); rec.second = other[1]; rec.margin = +(sc[0][0] - other[0]).toFixed(3); }
    return out; }
  window.VloxxGreenScan = { read, readNames };
})();
