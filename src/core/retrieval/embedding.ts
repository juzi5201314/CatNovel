const DEFAULT_DIMENSIONS = 64;

function normalize(vector: number[]): number[] {
  let squaredSum = 0;
  for (const value of vector) {
    squaredSum += value * value;
  }
  if (squaredSum === 0) {
    return vector;
  }
  const norm = Math.sqrt(squaredSum);
  return vector.map((value) => value / norm);
}

function mix(seed: number): number {
  let value = seed >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0;
}

export function embedText(text: string, dimensions = DEFAULT_DIMENSIONS): number[] {
  const vector = new Array<number>(dimensions).fill(0);
  if (text.length === 0) {
    return vector;
  }

  for (let index = 0; index < text.length; index += 1) {
    const codePoint = text.codePointAt(index) ?? 0;
    const slot = codePoint % dimensions;
    const mixed = mix(codePoint + index * 131);
    const signed = mixed % 2 === 0 ? 1 : -1;
    vector[slot] += signed * ((mixed % 1000) / 1000);
  }

  return normalize(vector);
}

export function embedTexts(texts: string[], dimensions = DEFAULT_DIMENSIONS): number[][] {
  return texts.map((text) => embedText(text, dimensions));
}

export function embeddingDimensions(): number {
  return DEFAULT_DIMENSIONS;
}
