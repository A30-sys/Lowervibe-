/**
 * Stamps a clean, subtle LOWERVIBE corner watermark onto uploaded square artwork
 * without obscuring faces or album typography.
 */
export function stampLowervibeCoverWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const minDim = Math.min(width, height);
  if (minDim < 140) return;

  const pad = Math.max(10, Math.round(minDim * 0.032));
  const fontSize = Math.max(9, Math.round(minDim * 0.022));
  const barWidth = Math.max(2, Math.round(fontSize * 0.19));
  const barGap = Math.max(1.5, Math.round(fontSize * 0.14));
  const barsWidth = barWidth * 3 + barGap * 2;
  const hPad = Math.max(6, Math.round(fontSize * 0.48));
  const vPad = Math.max(3, Math.round(fontSize * 0.28));
  const innerGap = Math.max(4, Math.round(fontSize * 0.34));
  const label = 'LOWERVIBE';

  ctx.save();
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const textWidth = ctx.measureText(label).width;
  const badgeWidth = hPad * 2 + barsWidth + innerGap + textWidth;
  const badgeHeight = fontSize + vPad * 2;
  const bx = width - pad - badgeWidth;
  const by = height - pad - badgeHeight;
  const radius = Math.max(5, Math.round(badgeHeight * 0.3));

  // Translucent dark plate for crisp legibility on bright or dark artwork
  ctx.beginPath();
  ctx.roundRect(bx, by, badgeWidth, badgeHeight, radius);
  ctx.fillStyle = 'rgba(10, 11, 10, 0.62)';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(198, 255, 61, 0.34)';
  ctx.stroke();

  // Mini 3-bar waveform mark
  const barsX = bx + hPad;
  const centerY = by + badgeHeight / 2;
  const barHeights = [
    Math.round(fontSize * 0.56),
    Math.round(fontSize * 0.94),
    Math.round(fontSize * 0.68),
  ];
  const barColors = ['#7C5CFF', '#C6FF3D', '#C6FF3D'];

  for (let i = 0; i < 3; i++) {
    const bh = barHeights[i];
    const rx = barsX + i * (barWidth + barGap);
    const ry = centerY - bh / 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, barWidth, bh, barWidth / 2);
    ctx.fillStyle = barColors[i];
    ctx.fill();
  }

  // Wordmark
  ctx.fillStyle = 'rgba(244, 245, 243, 0.92)';
  ctx.fillText(label, barsX + barsWidth + innerGap, centerY + 0.5);
  ctx.restore();
}
