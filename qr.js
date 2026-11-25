/**
 * Minimal, zero-dependency QR Code generator (Byte mode, ECC Level M, Versions 1..10).
 * Renders crisp inline SVG for LYRA's direct APK phone transfer QR code.
 */
(function (global) {
  "use strict";

  // Total data codewords & EC codewords per block for Level M, Versions 1..10 (single/multi block)
  // Format: [version, totalDataBytes, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data]
  const VERSION_SPECS = [
    null,
    [1, 16, 10, 1, 16, 0, 0],
    [2, 28, 16, 1, 28, 0, 0],
    [3, 44, 26, 1, 44, 0, 0],
    [4, 64, 18, 2, 32, 0, 0],
    [5, 86, 24, 2, 43, 0, 0],
    [6, 108, 16, 4, 27, 0, 0],
    [7, 124, 18, 4, 31, 0, 0],
    [8, 154, 22, 2, 38, 2, 39],
    [9, 182, 22, 3, 36, 2, 37],
    [10, 216, 26, 4, 43, 1, 44],
  ];

  const ALIGN_POS = [
    [],
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
  ];

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const factor = EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsCompute(data, ecLen) {
    const gen = rsGenerator(ecLen);
    const res = new Uint8Array(data.length + ecLen);
    res.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const coef = res[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  function chooseVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const cap = VERSION_SPECS[v][1];
      const headerBits = 4 + (v <= 9 ? 8 : 16);
      if (headerBits + byteLen * 8 <= cap * 8) return v;
    }
    return 10;
  }

  function encodeData(text) {
    const utf8 = new TextEncoder().encode(text);
    const version = chooseVersion(utf8.length);
    const spec = VERSION_SPECS[version];
    const totalData = spec[1];
    const maxBytes = totalData - (version <= 9 ? 2 : 3);
    const payload = utf8.slice(0, maxBytes);

    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };

    // Byte mode (0100)
    pushBits(0b0100, 4);
    pushBits(payload.length, version <= 9 ? 8 : 16);
    for (let i = 0; i < payload.length; i++) pushBits(payload[i], 8);

    const targetBits = totalData * 8;
    const termLen = Math.min(4, targetBits - bits.length);
    pushBits(0, termLen);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      dataBytes.push(b);
    }
    const pads = [0xec, 0x11];
    let p = 0;
    while (dataBytes.length < totalData) {
      dataBytes.push(pads[p++ % 2]);
    }

    const [, , ecPerBlock, g1Count, g1Len, g2Count, g2Len] = spec;
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (let i = 0; i < g1Count; i++) {
      const blk = Uint8Array.from(dataBytes.slice(offset, offset + g1Len));
      offset += g1Len;
      dataBlocks.push(blk);
      ecBlocks.push(rsCompute(blk, ecPerBlock));
    }
    for (let i = 0; i < g2Count; i++) {
      const blk = Uint8Array.from(dataBytes.slice(offset, offset + g2Len));
      offset += g2Len;
      dataBlocks.push(blk);
      ecBlocks.push(rsCompute(blk, ecPerBlock));
    }

    const finalBits = [];
    const pushByte = (b) => {
      for (let i = 7; i >= 0; i--) finalBits.push((b >>> i) & 1);
    };
    const maxDataLen = Math.max(g1Len, g2Len);
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (i < dataBlocks[b].length) pushByte(dataBlocks[b][i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < ecBlocks.length; b++) {
        pushByte(ecBlocks[b][i]);
      }
    }
    return { version, bits: finalBits };
  }

  function buildMatrix(version, bits) {
    const size = version * 4 + 17;
    const modules = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
    const isFunc = Array.from({ length: size }, () => new Uint8Array(size));

    function setFunc(r, c, val) {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      modules[r][c] = val ? 1 : 0;
      isFunc[r][c] = 1;
    }

    function drawFinder(top, left) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = top + r;
          const cc = left + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          const on =
            r >= 0 &&
            r <= 6 &&
            c >= 0 &&
            c <= 6 &&
            (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          setFunc(rr, cc, on);
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (let i = 8; i < size - 8; i++) {
      if (!isFunc[6][i]) setFunc(6, i, i % 2 === 0);
      if (!isFunc[i][6]) setFunc(i, 6, i % 2 === 0);
    }

    // Alignment patterns
    const pos = ALIGN_POS[version];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const cr = pos[i];
        const cc = pos[j];
        if (isFunc[cr][cc]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const d = Math.max(Math.abs(dr), Math.abs(dc));
            setFunc(cr + dr, cc + dc, d === 2 || d === 0);
          }
        }
      }
    }

    // Dark module
    setFunc(size - 8, 8, true);

    // Reserve format info
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        isFunc[8][i] = 1;
        isFunc[i][8] = 1;
      }
    }
    for (let i = 0; i < 8; i++) {
      isFunc[8][size - 1 - i] = 1;
      isFunc[size - 1 - i][8] = 1;
    }

    // Version info for >= 7
    if (version >= 7) {
      let rem = version;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const vBits = (version << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((vBits >>> i) & 1) === 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setFunc(a, b, bit);
        setFunc(b, a, bit);
      }
    }

    // Place data bits in zig-zag
    let bitIdx = 0;
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let step = 0; step < size; step++) {
        const r = upward ? size - 1 - step : step;
        for (let k = 0; k < 2; k++) {
          const c = right - k;
          if (!isFunc[r][c]) {
            const bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
            modules[r][c] = bit;
          }
        }
      }
      upward = !upward;
    }

    // Evaluate masks (0..7) and choose lowest penalty
    const maskFns = [
      (r, c) => (r + c) % 2 === 0,
      (r) => r % 2 === 0,
      (_r, c) => c % 3 === 0,
      (r, c) => (r + c) % 3 === 0,
      (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
      (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
      (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
      (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
    ];

    function applyMask(maskIdx) {
      const grid = modules.map((row) => Int8Array.from(row));
      const fn = maskFns[maskIdx];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (!isFunc[r][c] && fn(r, c)) grid[r][c] ^= 1;
        }
      }
      // Write format info (ECC M = 00)
      const data = (0b00 << 3) | maskIdx;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const fmt = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) grid[8][i] = (fmt >>> (14 - i)) & 1;
      grid[8][7] = (fmt >>> 8) & 1;
      grid[8][8] = (fmt >>> 7) & 1;
      grid[7][8] = (fmt >>> 6) & 1;
      for (let i = 9; i < 15; i++) grid[14 - i][8] = (fmt >>> (14 - i)) & 1;
      for (let i = 0; i < 8; i++) grid[size - 1 - i][8] = (fmt >>> i) & 1;
      for (let i = 8; i < 15; i++) grid[8][size - 15 + i] = (fmt >>> i) & 1;
      return grid;
    }

    function penalty(grid) {
      let score = 0;
      for (let r = 0; r < size; r++) {
        let run = 1;
        for (let c = 1; c < size; c++) {
          if (grid[r][c] === grid[r][c - 1]) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else run = 1;
        }
      }
      for (let c = 0; c < size; c++) {
        let run = 1;
        for (let r = 1; r < size; r++) {
          if (grid[r][c] === grid[r - 1][c]) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else run = 1;
        }
      }
      for (let r = 0; r < size - 1; r++) {
        for (let c = 0; c < size - 1; c++) {
          const v = grid[r][c];
          if (v === grid[r][c + 1] && v === grid[r + 1][c] && v === grid[r + 1][c + 1]) {
            score += 3;
          }
        }
      }
      return score;
    }

    let bestGrid = null;
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      const g = applyMask(m);
      const s = penalty(g);
      if (s < bestScore) {
        bestScore = s;
        bestGrid = g;
      }
    }
    return bestGrid;
  }

  function toSvg(text, options) {
    const opts = Object.assign({ quiet: 3, fg: "#07080C", bg: "#F3E7D8" }, options || {});
    const { version, bits } = encodeData(text);
    const grid = buildMatrix(version, bits);
    const size = grid.length;
    const total = size + opts.quiet * 2;
    const rects = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === 1) {
          rects.push(
            `<rect x="${c + opts.quiet}" y="${r + opts.quiet}" width="1" height="1" rx="0.16" fill="${opts.fg}"/>`
          );
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" aria-label="QR code for LYRA APK download" shape-rendering="geometricPrecision"><rect width="${total}" height="${total}" rx="2.5" fill="${opts.bg}"/>${rects.join("")}</svg>`;
  }

  global.LyraQR = { toSvg };
})(typeof window !== "undefined" ? window : globalThis);
