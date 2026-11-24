import { NotificationType } from '../types';

function loadCanvasSafeImage(url?: string, timeoutMs: number = 4500): Promise<HTMLImageElement | null> {
  if (!url || typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const img = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.referrerPolicy = 'no-referrer';
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);
    img.onload = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(img);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        resolve(null);
      }
    };
    img.src = url;
  });
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1];
    if (ctx.measureText(last).width > maxWidth) {
      let trimmed = last;
      while (trimmed.length > 3 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
      }
      lines[maxLines - 1] = `${trimmed}...`;
    }
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawLowervibeBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Outer charcoal rounded badge
  drawRoundedRect(ctx, 0, 0, 44, 44, 12);
  ctx.fillStyle = '#1b1e1b';
  ctx.fill();
  ctx.strokeStyle = 'rgba(198,255,61,0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lime waveform bars
  const bars = [
    { bx: 11, by: 17, bw: 4, bh: 10 },
    { bx: 17, by: 10, bw: 4, bh: 24 },
    { bx: 23, by: 14, bw: 4, bh: 16 },
    { bx: 29, by: 19, bw: 4, bh: 8 },
  ];
  ctx.fillStyle = '#c6ff3d';
  bars.forEach((b) => {
    drawRoundedRect(ctx, b.bx, b.by, b.bw, b.bh, 2);
    ctx.fill();
  });

  ctx.restore();
}

function triggerCanvasDownload(canvas: HTMLCanvasElement, filename: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
        resolve(true);
      }, 'image/png');
    } catch {
      resolve(false);
    }
  });
}

export async function exportReleasePromoCard(params: {
  title: string;
  subtitle: string;
  eyebrow: string;
  artworkUrl?: string;
  shortUrl: string;
  aspect?: 'square' | 'story';
}): Promise<boolean> {
  const isStory = params.aspect === 'story';
  const width = 1080;
  const height = isStory ? 1920 : 1080;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // Background
  ctx.fillStyle = '#0a0b0a';
  ctx.fillRect(0, 0, width, height);

  // Tonal studio glow
  const glow = ctx.createRadialGradient(width * 0.5, height * 0.25, 40, width * 0.5, height * 0.35, width * 0.8);
  glow.addColorStop(0, 'rgba(139, 110, 255, 0.32)');
  glow.addColorStop(0.55, 'rgba(198, 255, 61, 0.12)');
  glow.addColorStop(1, 'rgba(10, 11, 10, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // Header brand lockup
  drawLowervibeBrandMark(ctx, 72, isStory ? 110 : 64, 1.15);
  ctx.fillStyle = '#f4f5f3';
  ctx.font = '800 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('LOWERVIBE', 136, isStory ? 148 : 102);
  ctx.fillStyle = '#c6ff3d';
  ctx.font = '600 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(params.eyebrow, 72, isStory ? 215 : 152);

  // Artwork container
  const artSize = isStory ? 760 : 540;
  const artX = (width - artSize) / 2;
  const artY = isStory ? 275 : 190;

  ctx.save();
  drawRoundedRect(ctx, artX, artY, artSize, artSize, 40);
  ctx.fillStyle = '#131513';
  ctx.fill();
  ctx.clip();

  const img = await loadCanvasSafeImage(params.artworkUrl);
  if (img) {
    const scale = Math.max(artSize / img.width, artSize / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ctx.drawImage(img, artX + (artSize - drawW) / 2, artY + (artSize - drawH) / 2, drawW, drawH);
  } else {
    // Fallback vector studio disc
    const artGrad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
    artGrad.addColorStop(0, '#1b1e1b');
    artGrad.addColorStop(1, '#101210');
    ctx.fillStyle = artGrad;
    ctx.fillRect(artX, artY, artSize, artSize);

    ctx.beginPath();
    ctx.arc(artX + artSize / 2, artY + artSize / 2, artSize * 0.28, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(198,255,61,0.55)';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(artX + artSize / 2, artY + artSize / 2, artSize * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#c6ff3d';
    ctx.fill();
  }
  ctx.restore();

  // Artwork subtle border
  drawRoundedRect(ctx, artX, artY, artSize, artSize, 40);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Title & Artist
  const textY = artY + artSize + (isStory ? 95 : 74);
  ctx.fillStyle = '#f4f5f3';
  ctx.font = `800 ${isStory ? 62 : 50}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const titleLines = wrapCanvasText(ctx, params.title, width - 144, 2);
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, 72, textY + idx * (isStory ? 74 : 60));
  });

  const subY = textY + titleLines.length * (isStory ? 74 : 60) + 12;
  ctx.fillStyle = '#b5bbb4';
  ctx.font = `600 ${isStory ? 38 : 30}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const subLines = wrapCanvasText(ctx, params.subtitle, width - 144, 1);
  if (subLines[0]) {
    ctx.fillText(subLines[0], 72, subY);
  }

  // Bottom CTA Strip
  const footerY = height - (isStory ? 190 : 120);
  drawRoundedRect(ctx, 72, footerY, width - 144, 82, 22);
  ctx.fillStyle = '#c6ff3d';
  ctx.fill();

  ctx.fillStyle = '#0a0b0a';
  ctx.font = '800 28px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Stream Free on LOWERVIBE', 108, footerY + 51);

  ctx.font = '600 22px ui-monospace, monospace';
  const cleanHost = params.shortUrl.replace(/^https?:\/\//, '').slice(0, 34);
  const hostWidth = ctx.measureText(cleanHost).width;
  ctx.fillText(cleanHost, width - 108 - hostWidth, footerY + 50);

  const safeSlug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'release';
  return triggerCanvasDownload(canvas, `lowervibe-${safeSlug}-${isStory ? 'story' : 'card'}.png`);
}

export async function exportAlertBannerPng(params: {
  type: NotificationType;
  title: string;
  message: string;
  actionLabel?: string;
  artworkUrl?: string;
}): Promise<boolean> {
  const width = 1200;
  const height = 630;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const isDanger = params.type === 'upload_failed' || params.type === 'artist_rejected';
  const isAmber = params.type === 'maintenance' || params.type === 'account_security' || params.type === 'artist_pending';
  const isViolet = params.type === 'new_feature' || params.type === 'new_follower' || params.type === 'playlist_update';

  const accentHex = isDanger ? '#ff6b7a' : isAmber ? '#f59e0b' : isViolet ? '#a78bfa' : '#c6ff3d';
  const eyebrowMap: Record<string, string> = {
    new_release: 'New Music Release',
    artist_approved: 'Verified Artist Update',
    artist_pending: 'Application Review',
    artist_rejected: 'Application Notice',
    new_follower: 'Community Milestone',
    playlist_update: 'Curated Playlist Update',
    account_security: 'Security Notice',
    upload_completed: 'Release Live Now',
    upload_failed: 'Upload Notice',
    maintenance: 'Service Advisory',
    new_feature: 'Platform Feature Update',
    platform_announcement: 'Official Announcement',
  };
  const eyebrow = eyebrowMap[params.type] || 'Official LOWERVIBE Alert';

  // Charcoal canvas
  ctx.fillStyle = '#0a0b0a';
  ctx.fillRect(0, 0, width, height);

  const radial = ctx.createRadialGradient(140, 80, 20, 200, 140, 720);
  radial.addColorStop(0, isDanger ? 'rgba(255,107,122,0.20)' : isAmber ? 'rgba(245,158,11,0.18)' : isViolet ? 'rgba(139,110,255,0.22)' : 'rgba(198,255,61,0.16)');
  radial.addColorStop(1, 'rgba(10,11,10,0)');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);

  // Main alert card container
  const cardX = 64;
  const cardY = 64;
  const cardW = width - 128;
  const cardH = height - 128;

  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.fillStyle = '#131513';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top hairline accent
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 32);
  ctx.clip();
  ctx.fillStyle = accentHex;
  ctx.fillRect(cardX, cardY, cardW, 5);
  ctx.restore();

  // Header brand + eyebrow
  drawLowervibeBrandMark(ctx, cardX + 48, cardY + 48, 1);
  ctx.fillStyle = '#f4f5f3';
  ctx.font = '800 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('LOWERVIBE', cardX + 108, cardY + 75);

  ctx.fillStyle = accentHex;
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`·  ${eyebrow}`, cardX + 266, cardY + 75);

  // Optional right artwork preview
  const img = await loadCanvasSafeImage(params.artworkUrl);
  const textMaxW = img ? cardW - 350 : cardW - 96;

  if (img) {
    const thumbSize = 210;
    const thumbX = cardX + cardW - thumbSize - 48;
    const thumbY = cardY + 132;
    ctx.save();
    drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 26);
    ctx.clip();
    const scale = Math.max(thumbSize / img.width, thumbSize / img.height);
    ctx.drawImage(
      img,
      thumbX + (thumbSize - img.width * scale) / 2,
      thumbY + (thumbSize - img.height * scale) / 2,
      img.width * scale,
      img.height * scale
    );
    ctx.restore();
    drawRoundedRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 26);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Headline
  ctx.fillStyle = '#f4f5f3';
  ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
  const titleLines = wrapCanvasText(ctx, params.title, textMaxW, 2);
  titleLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 48, cardY + 168 + i * 54);
  });

  // Message body
  const msgY = cardY + 168 + titleLines.length * 54 + 22;
  ctx.fillStyle = '#b5bbb4';
  ctx.font = '500 26px "Plus Jakarta Sans", system-ui, sans-serif';
  const msgLines = wrapCanvasText(ctx, params.message, textMaxW, 3);
  msgLines.forEach((line, i) => {
    ctx.fillText(line, cardX + 48, msgY + i * 38);
  });

  // Footer bar
  const btnY = cardY + cardH - 96;
  const ctaLabel = params.actionLabel?.trim() || 'Listen at lowervibemusic.web.app';
  ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
  const btnW = Math.min(cardW - 360, ctx.measureText(ctaLabel).width + 64);

  drawRoundedRect(ctx, cardX + 48, btnY, btnW, 56, 16);
  ctx.fillStyle = isDanger ? '#ff6b7a' : '#c6ff3d';
  ctx.fill();

  ctx.fillStyle = isDanger ? '#ffffff' : '#0a0b0a';
  ctx.fillText(ctaLabel, cardX + 80, btnY + 35);

  ctx.fillStyle = '#9ea49d';
  ctx.font = '600 20px ui-monospace, monospace';
  const urlText = 'lowervibemusic.web.app';
  const urlW = ctx.measureText(urlText).width;
  ctx.fillText(urlText, cardX + cardW - 48 - urlW, btnY + 35);

  return triggerCanvasDownload(canvas, `lowervibe-banner-${params.type}.png`);
}
