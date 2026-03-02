export type SimplifiedTextDiffOp = "equal" | "add" | "remove";

export type SimplifiedTextDiffLine = {
  op: SimplifiedTextDiffOp;
  text: string;
};

const DEFAULT_MAX_LINES = 240;

function normalizeLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function buildFallbackDiff(beforeText: string, afterText: string): SimplifiedTextDiffLine[] {
  if (beforeText === afterText) {
    return [{ op: "equal", text: beforeText }];
  }

  return [
    ...(beforeText.length > 0 ? [{ op: "remove" as const, text: beforeText }] : []),
    ...(afterText.length > 0 ? [{ op: "add" as const, text: afterText }] : []),
  ];
}

export function buildSimplifiedTextDiff(
  beforeText: string,
  afterText: string,
  maxLines = DEFAULT_MAX_LINES,
): SimplifiedTextDiffLine[] {
  if (beforeText === afterText) {
    return [{ op: "equal", text: beforeText }];
  }

  const beforeLines = normalizeLines(beforeText);
  const afterLines = normalizeLines(afterText);
  if (beforeLines.length > maxLines || afterLines.length > maxLines) {
    return buildFallbackDiff(beforeText, afterText);
  }

  const rows = beforeLines.length;
  const cols = afterLines.length;
  const lcs = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));

  for (let rowIndex = rows - 1; rowIndex >= 0; rowIndex -= 1) {
    for (let colIndex = cols - 1; colIndex >= 0; colIndex -= 1) {
      if (beforeLines[rowIndex] === afterLines[colIndex]) {
        lcs[rowIndex][colIndex] = lcs[rowIndex + 1][colIndex + 1] + 1;
      } else {
        lcs[rowIndex][colIndex] = Math.max(lcs[rowIndex + 1][colIndex], lcs[rowIndex][colIndex + 1]);
      }
    }
  }

  const diffs: SimplifiedTextDiffLine[] = [];
  let rowIndex = 0;
  let colIndex = 0;
  while (rowIndex < rows && colIndex < cols) {
    if (beforeLines[rowIndex] === afterLines[colIndex]) {
      diffs.push({ op: "equal", text: beforeLines[rowIndex] });
      rowIndex += 1;
      colIndex += 1;
      continue;
    }

    if (lcs[rowIndex + 1][colIndex] >= lcs[rowIndex][colIndex + 1]) {
      diffs.push({ op: "remove", text: beforeLines[rowIndex] });
      rowIndex += 1;
      continue;
    }

    diffs.push({ op: "add", text: afterLines[colIndex] });
    colIndex += 1;
  }

  while (rowIndex < rows) {
    diffs.push({ op: "remove", text: beforeLines[rowIndex] });
    rowIndex += 1;
  }
  while (colIndex < cols) {
    diffs.push({ op: "add", text: afterLines[colIndex] });
    colIndex += 1;
  }

  return diffs;
}
