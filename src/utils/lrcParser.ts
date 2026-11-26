import { LrcLyricLine, LrcLyricsMetadata } from '../types';

export type LrcLine = LrcLyricLine;

export interface ParsedLyrics {
  hasLyrics: boolean;
  isSynced: boolean;
  lines: LrcLine[];
  plainLines: string[];
  metadata: LrcLyricsMetadata;
}

const TIMESTAMP_GLOBAL_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const METADATA_TAG_REGEX = /^\[(ti|ar|al|by|au|length|re|ve|offset):(.*)\]$/i;

function parseTimestampMatch(minsStr: string, secsStr: string, fracStr?: string): number {
  const mins = parseInt(minsStr, 10);
  const secs = parseInt(secsStr, 10);
  const msRaw = fracStr || '0';
  const frac =
    msRaw.length === 3
      ? parseInt(msRaw, 10) / 1000
      : msRaw.length === 2
      ? parseInt(msRaw, 10) / 100
      : parseInt(msRaw, 10) / 10;
  return mins * 60 + secs + frac;
}

export function formatLrcTimestamp(timeSeconds: number): string {
  const safe = Math.max(0, Number.isFinite(timeSeconds) ? timeSeconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseLrc(rawLyrics?: string | null): ParsedLyrics {
  if (!rawLyrics || !rawLyrics.trim()) {
    return {
      hasLyrics: false,
      isSynced: false,
      lines: [],
      plainLines: [],
      metadata: {},
    };
  }

  const rawLines = rawLyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const syncedLines: LrcLine[] = [];
  const plainLines: string[] = [];
  const metadata: LrcLyricsMetadata = {};

  for (const line of rawLines) {
    const metaMatch = METADATA_TAG_REGEX.exec(line);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === 'ti' && val) metadata.title = val;
      else if (key === 'ar' && val) metadata.artist = val;
      else if (key === 'al' && val) metadata.album = val;
      else if (key === 'by' && val) metadata.by = val;
      else if (key === 'offset' && val) {
        const parsedOffset = parseInt(val, 10);
        if (!Number.isNaN(parsedOffset)) {
          metadata.offsetMs = parsedOffset;
        }
      }
      continue;
    }

    const timestamps: number[] = [];
    TIMESTAMP_GLOBAL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP_GLOBAL_REGEX.exec(line)) !== null) {
      timestamps.push(parseTimestampMatch(match[1], match[2], match[3]));
    }

    if (timestamps.length > 0) {
      const text = line.replace(TIMESTAMP_GLOBAL_REGEX, '').trim();
      if (text) {
        for (const ts of timestamps) {
          syncedLines.push({
            timeSeconds: ts,
            text,
          });
        }
      }
    } else {
      plainLines.push(line);
    }
  }

  if (syncedLines.length > 0) {
    const offsetSeconds = (metadata.offsetMs || 0) / 1000;
    const adjusted = syncedLines
      .map((item) => ({
        timeSeconds: Math.max(0, item.timeSeconds + offsetSeconds),
        text: item.text,
      }))
      .sort((a, b) => a.timeSeconds - b.timeSeconds);

    return {
      hasLyrics: true,
      isSynced: true,
      lines: adjusted,
      plainLines: adjusted.map((l) => l.text),
      metadata,
    };
  }

  return {
    hasLyrics: plainLines.length > 0,
    isSynced: false,
    lines: [],
    plainLines,
    metadata,
  };
}

export function getActiveLrcIndex(
  lines: LrcLine[],
  currentTimeSeconds: number,
  lookaheadSeconds: number = 0.15
): number {
  if (!lines || lines.length === 0) return -1;
  let activeIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (currentTimeSeconds + lookaheadSeconds >= lines[i].timeSeconds) {
      activeIdx = i;
    } else {
      break;
    }
  }
  return activeIdx;
}

export function stripLrcTimestamps(rawLyrics?: string | null): string {
  const parsed = parseLrc(rawLyrics);
  if (!parsed.hasLyrics) return '';
  return parsed.plainLines.join('\n');
}
