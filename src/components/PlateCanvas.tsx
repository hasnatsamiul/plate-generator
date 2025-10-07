import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { Plate } from "../types";



// Remote default motif
const DEFAULT_MOTIF =
  "https://rueckwand24.com/cdn/shop/files/Kuechenrueckwand-Kuechenrueckwand-Gruene-frische-Kraeuter-KR-000018-HB.jpg?v=1695288356&width=1200";
const fallbackMotif = "/motif-fallback.jpg";
const OUTER_PAD = 24;
const GAP_PX = 8;
// const STAGGER_PX = 0;
const CARD_W_RATIO = 1.0;  // gray card almost full width
const CARD_H_RATIO = 0.95; // gray card tall

type Props = {
  plates: Plate[];
  motifSrc?: string | null; // user upload (blob url) or undefined
};

export type PlateCanvasHandle = {
  exportPNG: () => string | null;
};

type MotifSource = "user" | "remote" | "local" | "none";

/* ------------------------- image loading helpers ------------------------- */

function loadImageWithTimeout(
  src: string,
  { cors, timeoutMs = 6000 }: { cors: boolean; timeoutMs?: number }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous"; // avoids taint if server allows CORS

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("image load timeout"));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
    }

    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () => {
      cleanup();
      reject(new Error("image load error"));
    };
    img.src = src;
  });
}

/** Try user motif (if any) → remote default → local bundled fallback. Returns img + where it came from. */
async function loadMotifChainDetailed(
  userSrc?: string | null
): Promise<{ img: HTMLImageElement | null; source: MotifSource }> {
  // 1) user upload / blob url (cors harmless)
  if (userSrc) {
    try {
      const img = await loadImageWithTimeout(userSrc, { cors: true, timeoutMs: 7000 });
      return { img, source: "user" };
    } catch {
      // continue
    }
  }
  // 2) remote default (may fail due to CORS/network)
  try {
    const img = await loadImageWithTimeout(DEFAULT_MOTIF, { cors: true, timeoutMs: 7000 });
    return { img, source: "remote" };
  } catch {
    // continue
  }
  // 3) local bundled fallback (always available)
  try {
    const img = await loadImageWithTimeout(fallbackMotif, { cors: false, timeoutMs: 7000 });
    return { img, source: "local" };
  } catch {
    return { img: null, source: "none" };
  }
}

/* ----------------------------- component ----------------------------- */

const PlateCanvas = forwardRef<PlateCanvasHandle, Props>(({ plates, motifSrc }, ref) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [motifSource, setMotifSource] = useState<MotifSource>("none");

  // Safe export: return null if canvas is tainted (CORS) or unavailable
  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      try {
        return canvasRef.current?.toDataURL("image/png") ?? null;
      } catch {
        return null;
      }
    },
  }));

  // Load motif with fallback chain
  useEffect(() => {
    let alive = true;
    loadMotifChainDetailed(motifSrc)
      .then(({ img, source }) => {
        if (!alive) return;
        setImg(img);
        setMotifSource(source);
      })
      .catch(() => {
        if (!alive) return;
        setImg(null);
        setMotifSource("none");
      });
    return () => {
      alive = false;
    };
  }, [motifSrc]);

  // Observe wrapper size
  const [containerSize, setContainerSize] = useState({ w: 800, h: 500 });
  useEffect(() => {
    const el = wrapperRef.current!;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setContainerSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const metrics = useMemo(() => {
    const totalWcm = plates.reduce((s, p) => s + p.widthCm, 0);
    const maxHcm = Math.max(...plates.map((p) => p.heightCm));
    return { totalWcm, maxHcm };
  }, [plates]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const DPR = Math.min(2, window.devicePixelRatio || 1);

    // Canvas size matches wrapper (gray card is fixed fraction of this)
    const cssW = Math.max(200, containerSize.w);
    const cssH = Math.max(220, containerSize.h);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);

    ctx.resetTransform();
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, cssW, cssH);

    // Gray card (fixed relative size)
    const cardW = Math.floor(cssW * CARD_W_RATIO);
    const cardH = Math.floor(cssH * CARD_H_RATIO);
    const x0 = Math.floor((cssW - cardW) / 2);
    const y0 = Math.floor((cssH - cardH) / 2);

    roundRect(ctx, x0, y0, cardW, cardH, 16);
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + cardH);
    grad.addColorStop(0, "#f7f7f9");
    grad.addColorStop(1, "#e6e7eb");
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x0, y0, cardW, cardH, 16);
    ctx.strokeStyle = "rgba(0,0,0,0.02)";
    ctx.stroke();
    ctx.restore();

    // Usable area inside card
    const ix = x0 + OUTER_PAD;
    const iy = y0 + OUTER_PAD;
    const usableW = cardW - OUTER_PAD * 2;
    const usableH = cardH - OUTER_PAD * 2;

    // Plate scaling inside fixed card
    const totalWcm = Math.max(1, metrics.totalWcm);
    const maxHcm = Math.max(1, metrics.maxHcm);
    const gapsPx = GAP_PX * Math.max(0, plates.length - 1);

    const scaleByW = (usableW - gapsPx) / totalWcm;
    const scaleByH = usableH / maxHcm;
    const scale = Math.max(0.1, Math.min(scaleByW, scaleByH));

    const innerW = totalWcm * scale + gapsPx;
    const innerH = maxHcm * scale;

    if (img) {
      // Offscreen motif strip
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(totalWcm * scale));
      off.height = Math.max(1, Math.round(innerH));
      const o = off.getContext("2d")!;

      const tileH = off.height;
      const tileW = Math.max(1, Math.round((img.naturalWidth * tileH) / img.naturalHeight));

      // center-first tiling with mirroring for seamless extension
      const centerX = Math.floor(off.width / 2 - tileW / 2);
      drawTile(o, img, centerX, 0, tileW, tileH, false);
      let L = centerX, R = centerX + tileW, i = 1;
      while (L > 0 || R < off.width) {
        const mirror = i % 2 === 1;
        const leftX = L - tileW;
        const rightX = R;
        if (leftX + tileW > 0) drawTile(o, img, leftX, 0, tileW, tileH, mirror);
        if (rightX < off.width) drawTile(o, img, rightX, 0, tileW, tileH, mirror);
        L -= tileW; R += tileW; i++;
      }

      // Center plates block inside card
      const startX = Math.floor(ix + (usableW - innerW) / 2);
      const startY = Math.floor(iy + (usableH - innerH) / 2);

      let acc = 0;
      plates.forEach((p, idx) => {
        const w = Math.max(0, p.widthCm * scale);
        const h = Math.max(0, p.heightCm * scale);

        const sx = Math.floor(acc);
        // const sy = Math.floor((off.height - h) / 2);
        const sy = Math.max(0, Math.floor(off.height - h));

        const dx = Math.floor(startX + acc + GAP_PX * idx);
        // const dy = Math.floor(startY + (off.height - h) / 2 + (idx > 0 ? STAGGER_PX : 0));
        const baselineY = startY + innerH;        // bottom of the inner area
        const dy = Math.floor(baselineY - h);

        // plate with shadow
        ctx.save();
        roundedClip(ctx, dx, dy, w, h, 10);
        ctx.shadowColor = "rgba(0,0,0,0.25)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = "rgba(0,0,0,0)";
        ctx.fillRect(dx, dy, w, h);
        ctx.shadowColor = "transparent";

        ctx.drawImage(off, sx, sy, Math.floor(w), Math.floor(h), dx, dy, Math.floor(w), Math.floor(h));
        ctx.restore();

        // border
        ctx.save();
        roundRect(ctx, dx, dy, w, h, 10);
        ctx.strokeStyle = "rgba(0,0,0,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        acc += p.widthCm * scale;
      });
    } else {
      // If nothing loaded, draw a centered placeholder area
      const startX = Math.floor(ix + (usableW - innerW) / 2);
      const startY = Math.floor(iy + (usableH - innerH) / 2);
      ctx.fillStyle = "#cfd3d9";
      ctx.fillRect(startX, startY, innerW, innerH);
    }
  }, [plates, img, containerSize, metrics]);

  return (
    <div className="left" ref={wrapperRef} style={{ position: "relative" }}>
      {/* Badge: show only when we fell back to local image */}
      {motifSource === "local" && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 2,
            fontSize: 12,
            fontWeight: 600,
            background: "rgba(17,24,39,0.85)",
            color: "#fff",
            padding: "6px 8px",
            borderRadius: 8,
            pointerEvents: "none",
            maxWidth: "60%",
            lineHeight: 1.2,
          }}
        >
          Remote motif is not working, using local image.
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  );
});

export default PlateCanvas;

/* ---------------- helpers ---------------- */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function roundedClip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  roundRect(ctx, x, y, w, h, r);
  ctx.save();
  ctx.clip();
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  mirror: boolean
) {
  ctx.save();
  if (mirror) {
    ctx.translate(x + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w / 2), 0);
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}
