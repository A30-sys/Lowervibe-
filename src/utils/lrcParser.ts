import { LrcLyricLine, LrcLyricsMetadata, LrcWordToken } from '../types';

export type LrcLine = LrcLyricLine;

export interface ParsedLyrics {
  hasLyrics: boolean;
  isSynced: boolean;
  lines: LrcLine[];
  plainLines: string[];
  metadata: LrcLyricsMetadata;
}

export interface WordTimingItem {
  text: string;
  trailingSpace: string;
  progress: number; // 0..1
  state: 'sung' | 'active' | 'upcoming';
}

export interface LineTimingState {
  lineProgress: number; // 0..1
  words: WordTimingItem[];
}

const TIMESTAMP_GLOBAL_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const WORD_TAG_REGEX = /<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g;
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

function parseEnhancedWordTokens(rawBody: string, lineStartSeconds: number): {
  cleanText: string;
  words?: LrcWordToken[];
} {
  WORD_TAG_REGEX.lastIndex = 0;
  if (!WORD_TAG_REGEX.test(rawBody)) {
    return { cleanText: rawBody.trim() };
  }

  WORD_TAG_REGEX.lastIndex = 0;
  const tokens: LrcWordToken[] = [];
  let lastIndex = 0;
  let currentTagTime = lineStartSeconds;
  let match: RegExpExecArray | null;

  const pushSegment = (segment: string, ts: number) => {
    const parts = segment.trim().split(/\s+/).filter(Boolean);
    for (const part of parts) {
      tokens.push({ timeSeconds: ts, text: part });
    }
  };

  while ((match = WORD_TAG_REGEX.exec(rawBody)) !== null) {
    const before = rawBody.slice(lastIndex, match.index);
    if (before.trim()) {
      pushSegment(before, currentTagTime);
    }
    currentTagTime = parseTimestampMatch(match[1], match[2], match[3]);
    lastIndex = match.index + match[0].length;
  }

  const tail = rawBody.slice(lastIndex);
  if (tail.trim()) {
    pushSegment(tail, currentTagTime);
  }

  const cleanText = rawBody.replace(WORD_TAG_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
  return {
    cleanText,
    words: tokens.length > 0 ? tokens : undefined,
  };
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
      const rawBody = line.replace(TIMESTAMP_GLOBAL_REGEX, '').trim();
      if (rawBody) {
        for (const ts of timestamps) {
          const { cleanText, words } = parseEnhancedWordTokens(rawBody, ts);
          if (cleanText) {
            syncedLines.push({
              timeSeconds: ts,
              text: cleanText,
              ...(words ? { words } : {}),
            });
          }
        }
      }
    } else {
      const cleanedPlain = line.replace(WORD_TAG_REGEX, ' ').replace(/\s{2,}/g, ' ').trim();
      if (cleanedPlain) plainLines.push(cleanedPlain);
    }
  }

  if (syncedLines.length > 0) {
    const offsetSeconds = (metadata.offsetMs || 0) / 1000;
    const adjusted = syncedLines
      .map((item) => ({
        timeSeconds: Math.max(0, item.timeSeconds + offsetSeconds),
        text: item.text,
        ...(item.words
          ? {
              words: item.words.map((w) => ({
                timeSeconds: Math.max(0, w.timeSeconds + offsetSeconds),
                text: w.text,
              })),
            }
          : {}),
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
  lookaheadSeconds: number = 0.08
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

export function getLineTimingState(
  lines: LrcLine[],
  lineIndex: number,
  currentTimeSeconds: number,
  trackDurationSeconds: number
): LineTimingState {
  const line = lines[lineIndex];
  if (!line) {
    return { lineProgress: 0, words: [] };
  }

  const lineStart = line.timeSeconds;
  const nextLineTime = lines[lineIndex + 1]?.timeSeconds;
  const fallbackEnd =
    trackDurationSeconds > lineStart + 0.5
      ? Math.min(trackDurationSeconds, lineStart + 14)
      : lineStart + 6;
  const lineEnd =
    typeof nextLineTime === 'number' && nextLineTime > lineStart
      ? Math.max(lineStart + 0.35, nextLineTime)
      : Math.max(lineStart + 1.5, fallbackEnd);

  const lineSpan = Math.max(0.25, lineEnd - lineStart);
  const lineProgress = Math.max(0, Math.min(1, (currentTimeSeconds - lineStart) / lineSpan));

  if (line.words && line.words.length > 0) {
    const words: WordTimingItem[] = line.words.map((w, idx) => {
      const start = w.timeSeconds;
      const end =
        idx + 1 < line.words!.length
          ? Math.max(start + 0.12, line.words![idx + 1].timeSeconds)
          : lineEnd;
      const span = Math.max(0.12, end - start);
      const progress = Math.max(0, Math.min(1, (currentTimeSeconds - start) / span));
      const state: WordTimingItem['state'] =
        currentTimeSeconds >= end
          ? 'sung'
          : currentTimeSeconds >= start
          ? 'active'
          : 'upcoming';
      return {
        text: w.text,
        trailingSpace: idx < line.words!.length - 1 ? ' ' : '',
        progress,
        state,
      };
    });
    return { lineProgress, words };
  }

  // Proportional word-by-word interpolation weighted by syllable/character length
  const rawWords = line.text.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) {
    return { lineProgress, words: [] };
  }

  const weights = rawWords.map((w) => Math.max(1.5, w.replace(/[^a-zA-Z0-9']/g, '').length + 1));
  const totalWeight = weights.reduce((acc, w) => acc + w, 0) || rawWords.length;

  let cursor = lineStart;
  const words: WordTimingItem[] = rawWords.map((word, idx) => {
    const share = (weights[idx] / totalWeight) * lineSpan;
    const start = cursor;
    const end = idx === rawWords.length - 1 ? lineEnd : start + share;
    cursor = end;
    const span = Math.max(0.08, end - start);
    const progress = Math.max(0, Math.min(1, (currentTimeSeconds - start) / span));
    const state: WordTimingItem['state'] =
      currentTimeSeconds >= end
        ? 'sung'
        : currentTimeSeconds >= start
        ? 'active'
        : 'upcoming';
    return {
      text: word,
      trailingSpace: idx < rawWords.length - 1 ? ' ' : '',
      progress,
      state,
    };
  });

  return { lineProgress, words };
}

export function getPlainLyricsProgress(
  plainLines: string[],
  currentTimeSeconds: number,
  trackDurationSeconds: number
): { activeIndex: number; lineProgress: number } {
  if (!plainLines || plainLines.length === 0 || trackDurationSeconds <= 0) {
    return { activeIndex: -1, lineProgress: 0 };
  }
  const safeDuration = Math.max(1, trackDurationSeconds);
  const clamped = Math.max(0, Math.min(safeDuration, currentTimeSeconds));
  const overallProgress = clamped / safeDuration;
  const exactIndex = overallProgress * plainLines.length;
  const activeIndex = Math.min(plainLines.length - 1, Math.floor(exactIndex));
  const lineProgress = Math.max(0, Math.min(1, exactIndex - activeIndex));
  return { activeIndex, lineProgress };
}

export function stripLrcTimestamps(rawLyrics?: string | null): string {
  const parsed = parseLrc(rawLyrics);
  if (!parsed.hasLyrics) return '';
  return parsed.plainLines.join('\n');
}
