export interface ExtractedPalette {
  primary: string;
  secondary: string;
}

const DEFAULT_PALETTE: ExtractedPalette = {
  primary: 'rgba(124, 92, 255, 0.34)',
  secondary: 'rgba(198, 255, 61, 0.14)',
};

const paletteCache = new Map<string, ExtractedPalette>();

export async function extractDominantColor(imageUrl?: string): Promise<ExtractedPalette> {
  if (!imageUrl || typeof window === 'undefined') return DEFAULT_PALETTE;
  const cached = paletteCache.get(imageUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }

    const timeout = window.setTimeout(() => resolve(DEFAULT_PALETTE), 2000);

    img.onload = () => {
      window.clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 24;
        canvas.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }
        ctx.drawImage(img, 0, 0, 24, 24);
        const { data } = ctx.getImageData(0, 0, 24, 24);

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let count = 0;

        let vibrantR = 124;
        let vibrantG = 92;
        let vibrantB = 255;
        let maxScore = -1;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 128) continue;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const lum = (r + g + b) / (3 * 255);

          // Bias toward rich mid-luminance pixels for background tinting
          if (lum > 0.12 && lum < 0.88) {
            rSum += r;
            gSum += g;
            bSum += b;
            count++;

            const score = sat * (1 - Math.abs(lum - 0.5));
            if (score > maxScore) {
              maxScore = score;
              vibrantR = r;
              vibrantG = g;
              vibrantB = b;
            }
          }
        }

        if (count === 0) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        const avgR = Math.round(rSum / count);
        const avgG = Math.round(gSum / count);
        const avgB = Math.round(bSum / count);

        const result: ExtractedPalette = {
          primary: `rgba(${vibrantR}, ${vibrantG}, ${vibrantB}, 0.42)`,
          secondary: `rgba(${avgR}, ${avgG}, ${avgB}, 0.24)`,
        };
        paletteCache.set(imageUrl, result);
        resolve(result);
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(DEFAULT_PALETTE);
    };

    img.src = imageUrl;
  });
}
