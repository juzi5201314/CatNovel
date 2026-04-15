type UnknownJson =
  | null
  | string
  | number
  | boolean
  | UnknownJson[]
  | { [key: string]: UnknownJson };

function collectText(value: UnknownJson, chunks: string[]) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, chunks);
    }
    return;
  }

  if (value && typeof value === "object") {
    if (typeof value.text === "string") {
      chunks.push(value.text);
    } else {
      for (const item of Object.values(value)) {
        collectText(item, chunks);
      }
    }
  }
}

export function extractPlaintext(bodyJson: string) {
  try {
    const parsed = JSON.parse(bodyJson) as UnknownJson;
    const chunks: string[] = [];
    collectText(parsed, chunks);
    return chunks.join(" ").replace(/\s+/g, " ").trim();
  } catch {
    return bodyJson.replace(/\s+/g, " ").trim();
  }
}

export function buildExcerpt(plaintext: string, maxLength = 48) {
  if (plaintext.length <= maxLength) {
    return plaintext;
  }

  return `${plaintext.slice(0, maxLength).trimEnd()}…`;
}

export function countWords(plaintext: string) {
  const latinWords = plaintext
    .split(/\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  const cjkChars = [...plaintext].filter((char) => /\p{Script=Han}/u.test(char)).length;

  return Math.max(latinWords.length, cjkChars > 0 ? cjkChars : 0);
}

export function countCharacters(plaintext: string) {
  return [...plaintext.replace(/\s+/gu, "")].length;
}

export function countParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}

export function estimateReadingMinutes(wordCount: number) {
  return Math.max(1, Math.ceil(wordCount / 200));
}

export function deriveChapterMetrics(bodyJson: string) {
  const plaintext = extractPlaintext(bodyJson);
  const wordCount = countWords(plaintext);
  const characterCount = countCharacters(plaintext);

  return {
    plaintext,
    excerpt: buildExcerpt(plaintext),
    wordCount,
    characterCount,
    readingMinutes: estimateReadingMinutes(wordCount),
  };
}
