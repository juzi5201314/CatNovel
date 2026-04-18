export function countCharacters(plaintext: string) {
  return [...plaintext.replace(/\s+/gu, '')].length;
}

export function countParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean).length;
}
