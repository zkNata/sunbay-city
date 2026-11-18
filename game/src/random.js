// A small seeded random number generator (mulberry32): the same seed builds the same city,
// which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, array) {
  return array[Math.floor(rand() * array.length)];
}

export function range(rand, min, max) {
  return min + rand() * (max - min);
}

export function rangeInt(rand, min, max) {
  return min + Math.floor(rand() * (max - min + 1));
}
