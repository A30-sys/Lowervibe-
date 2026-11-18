export interface LrcLine {
  timeSeconds: number;
  text: string;
}

export interface ParsedLyrics {
  hasLyrics: boolean;
  isSynced: boolean;
  lines: LrcLine[];
  plainLines: string[];
}

const LRC_LINE_REGEX = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;

export function parseLrc(rawLyrics?: string | null): ParsedLyrics {
  if (!rawLyrics || !rawLyrics.trim()) {
    return {
      hasLyrics: false,
      isSynced: false,
      lines: [],
      plainLines: [],
    };
  }

  const rawLines = rawLyrics
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const syncedLines: LrcLine[] = [];
  const plainLines: string[] = [];

  for (const line of rawLines) {
    const match = LRC_LINE_REGEX.exec(line);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const msRaw = match[3] || '0';
      const ms =
        msRaw.length === 3
          ? parseInt(msRaw, 10) / 1000
          : msRaw.length === 2
          ? parseInt(msRaw, 10) / 100
          : parseInt(msRaw, 10) / 10;
      const text = (match[4] || '').trim();
      if (text) {
        syncedLines.push({
          timeSeconds: mins * 60 + secs + ms,
          text,
        });
      }
    } else if (!/^\[(ti|ar|al|by|offset):/i.test(line)) {
      plainLines.push(line);
    }
  }

  if (syncedLines.length > 0) {
    syncedLines.sort((a, b) => a.timeSeconds - b.timeSeconds);
    return {
      hasLyrics: true,
      isSynced: true,
      lines: syncedLines,
      plainLines: syncedLines.map(l => l.text),
    };
  }

  return {
    hasLyrics: plainLines.length > 0,
    isSynced: false,
    lines: [],
    plainLines,
  };
}
