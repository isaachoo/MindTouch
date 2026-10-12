// Draws a quote as a square-ish PNG and hands it to the phone's share sheet.
// Falls back to downloading the image and copying the text when sharing files is not supported.
import type { Quote } from './data';

const SITE = 'https://mt.ohcasi.com';
const W = 1080;
const H = 1350;

const C = {
  bg1: '#fbf5ee',
  bg2: '#f6e6de',
  card: '#fffdfa',
  text: '#3d2e2a',
  muted: '#8a6f66',
  accent: '#d98c7e',
  accentDeep: '#c4715f',
  divider: 'rgba(120, 80, 60, 0.14)',
};

const SERIF = '"Noto Serif TC", "Songti TC", "PMingLiU", "Noto Serif CJK TC", Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

/** Wrap text to a width. CJK breaks per character; Latin breaks on spaces. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    const hasCjk = /[぀-ヿ㐀-鿿]/.test(para);
    const units = hasCjk ? [...para] : para.split(/(\s+)/).filter((u) => u.length > 0);
    let line = '';
    for (const u of units) {
      const candidate = line + u;
      if (ctx.measureText(candidate).width <= maxWidth || line === '') {
        line = candidate;
      } else {
        lines.push(line.trimEnd());
        line = u.trimStart();
      }
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function heart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.6, cy - s * 1.1, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.6, cy - s * 1.1, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.9);
  ctx.closePath();
  ctx.fill();
}

async function ensureFonts() {
  try {
    await Promise.race([
      Promise.all([document.fonts.load(`600 60px "Noto Serif TC"`), document.fonts.load(`400 40px "Noto Serif TC"`)]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

export async function renderQuoteImage(quote: Quote): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // background
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // card
  const pad = 72;
  const cardX = pad;
  const cardY = 150;
  const cardW = W - pad * 2;
  const cardH = H - cardY - 150;
  ctx.shadowColor = 'rgba(120, 70, 50, 0.14)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = C.card;
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // brand
  ctx.fillStyle = C.accent;
  heart(ctx, W / 2 - 62, 92, 16);
  ctx.fillStyle = C.text;
  ctx.font = `600 40px ${SERIF}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('點一下', W / 2 - 34, 92);

  // quote text: pick a size that fits
  const innerX = cardX + 72;
  const innerW = cardW - 144;
  const showOrig = quote.orig.trim() !== quote.zh.trim();
  let zhSize = 64;
  let zhLines: string[] = [];
  let origSize = 34;
  let origLines: string[] = [];
  const available = cardH - 72 * 2 - 130; // leave room for author block
  for (;;) {
    ctx.font = `600 ${zhSize}px ${SERIF}`;
    zhLines = wrap(ctx, quote.zh, innerW);
    origSize = Math.round(zhSize * 0.53);
    ctx.font = quote.lang === 'en' ? `italic 400 ${origSize}px Georgia, serif` : `400 ${origSize}px ${SERIF}`;
    origLines = showOrig ? wrap(ctx, quote.orig, innerW) : [];
    const needed = zhLines.length * zhSize * 1.6 + (showOrig ? 40 + origLines.length * origSize * 1.6 : 0);
    if (needed <= available || zhSize <= 34) break;
    zhSize -= 4;
  }

  const zhLH = zhSize * 1.6;
  const origLH = origSize * 1.6;
  const blockH = zhLines.length * zhLH + (showOrig ? 40 + origLines.length * origLH : 0);
  let y = cardY + 72 + Math.max(0, (available - blockH) / 2);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text;
  ctx.font = `600 ${zhSize}px ${SERIF}`;
  for (const line of zhLines) {
    y += zhLH;
    ctx.fillText(line, innerX, y - zhLH * 0.3);
  }
  if (showOrig) {
    y += 40;
    ctx.fillStyle = C.muted;
    ctx.font = quote.lang === 'en' ? `italic 400 ${origSize}px Georgia, serif` : `400 ${origSize}px ${SERIF}`;
    for (const line of origLines) {
      y += origLH;
      ctx.fillText(line, innerX, y - origLH * 0.3);
    }
  }

  // author block at the bottom of the card
  const lineY = cardY + cardH - 120;
  ctx.strokeStyle = C.divider;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, lineY);
  ctx.lineTo(innerX + innerW, lineY);
  ctx.stroke();
  ctx.fillStyle = C.muted;
  ctx.font = `400 32px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`— ${quote.author}`, innerX, lineY + 60);

  // footer link
  ctx.fillStyle = C.accentDeep;
  ctx.font = `500 30px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillText('mt.ohcasi.com', W / 2, H - 70);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export async function shareQuote(quote: Quote): Promise<ShareOutcome> {
  const blob = await renderQuoteImage(quote);
  const file = new File([blob], 'dim-yat-ha.png', { type: 'image/png' });
  const text = `${quote.zh}${quote.orig.trim() !== quote.zh.trim() ? `\n${quote.orig}` : ''}\n— ${quote.author}\n${SITE}`;

  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text, title: '點一下' });
      return 'shared';
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  if (nav.share) {
    try {
      await nav.share({ text, url: SITE, title: '點一下' });
      return 'shared';
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  // Desktop fallback: download the image and copy the text.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be unavailable */
  }
  return 'downloaded';
}
