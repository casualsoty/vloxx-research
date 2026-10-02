// Minimal arcdps EVTC parser (revision 1, 64-byte events). Reads .zevtc (zip) or unzipped .evtc directly.
// Event field names: sc = is_statechange, act = is_activation, brem = is_buffremove.
// Statechanges used in this research (arcdps build 20260929):
//   4 dead, 5 downed, 3/6 up/spawn, 7 despawn, 8 health update (dst = %*100), 9 log start, 12 max health,
//   19 position (dst = float x,y), 22 team change, 24 targetable, 34 breakbar state (0 active, 2 immune...),
//   35 breakbar percent (value = float), 57/58/59 missile create/launch/remove,
//   60/61 ground effect create/remove (dst = packed int16 x/10,y/10,z/10), 62/63 agent effect create/remove,
//   67/68 skill cast start/end (new cast events), 69 buff apply, 71 buff remove single (src = bearer), 72 buff remove all (src = bearer),
//   77 (Ascension Orb "consumed" / end event).
const fs = require('fs');
const zlib = require('zlib');

function readMaybeZip(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x04034b50) return buf; // not a zip
  // find central directory end
  let eocd = buf.length - 22; while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const cdOff = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cdOff + 10), csize = buf.readUInt32LE(cdOff + 20), lho = buf.readUInt32LE(cdOff + 42);
  const n = buf.readUInt16LE(lho + 26), m = buf.readUInt16LE(lho + 28);
  const data = buf.subarray(lho + 30 + n + m, lho + 30 + n + m + csize);
  return method === 0 ? data : zlib.inflateRawSync(data);
}

function parseEvtc(file) {
  const b = readMaybeZip(file);
  let o = 16;
  const nAg = b.readUInt32LE(o); o += 4;
  const agents = new Map();
  for (let i = 0; i < nAg; i++) {
    const addr = b.readBigUInt64LE(o), prof = b.readUInt32LE(o + 8), elite = b.readUInt32LE(o + 12);
    const name = b.subarray(o + 28, o + 92).toString('utf8');
    agents.set(addr, { addr, prof, elite, name, isPlayer: elite !== 0xffffffff, species: elite === 0xffffffff ? (prof & 0xffff) : null,
      hitboxWidth: b.readInt16LE(o + 22) });
    o += 96;
  }
  const nSk = b.readUInt32LE(o); o += 4;
  const skills = new Map();
  for (let i = 0; i < nSk; i++) { skills.set(b.readInt32LE(o), b.toString('utf8', o + 4, o + 68).split('\0')[0]); o += 68; }
  const ev = []; const o0 = o;
  for (; o + 64 <= b.length; o += 64) {
    ev.push({ t: Number(b.readBigUInt64LE(o)), src: b.readBigUInt64LE(o + 8), dst: b.readBigUInt64LE(o + 16), value: b.readInt32LE(o + 24),
      buffDmg: b.readInt32LE(o + 28), over: b.readUInt32LE(o + 32), skill: b.readUInt32LE(o + 36), srcInst: b.readUInt16LE(o + 40),
      dstInst: b.readUInt16LE(o + 42), srcMaster: b.readUInt16LE(o + 44), iff: b[o + 48], buff: b[o + 49], result: b[o + 50],
      act: b[o + 51], brem: b[o + 52], sc: b[o + 56] });
  }
  return { agents, skills, ev, evStart: o0, buf: b, header: b.toString('latin1', 0, 12), revision: b[12], bossId: b.readUInt16LE(13) };
}
module.exports = { parseEvtc, readMaybeZip };
