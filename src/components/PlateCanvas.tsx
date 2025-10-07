import {
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

//Otherwise from local storage
const fallbackMotif = "/motif-fallback.jpg";
const OUTER_PAD = 24;
const GAP_PX = 8;

type Props = {
  plates: Plate[];
  motifSrc?: string | null;
};

export type PlateCanvasHandle = {
  exportPNG: () => string | null;
};

type MotifSource = "user" | "remote" | "local" | "none";

/* ---------- image loading helpers ----------- */
function loadImageWithTimeout(
  src: string,
  { cors, timeoutMs = 6000 }: { cors: boolean; timeoutMs?: number }
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
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

async function loadMotifChainDetailed(
  userSrc?: string | null
): Promise<{ img: HTMLImageElement | null; source: MotifSource }> {
  if (userSrc) {
    try {
      const img = await loadImageWithTimeout(userSrc, { cors: true });
      return { img, source: "user" };
    } catch {}
  }
  try {
    const img = await loadImageWithTimeout(DEFAULT_MOTIF, { cors: true });
    return { img, source: "remote" };
  } catch {}
  try {
    const img = await loadImageWithTimeout(fallbackMotif, { cors: false });
    return { img, source: "local" };
  } catch {
    return { img: null, source: "none" };
  }
}

/* -------------------- component ----------------------- */

const PlateCanvas = forwardRef<PlateCanvasHandle, Props>(({ plates, motifSrc }, ref) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [motifSource, setMotifSource] = useState<MotifSource>("none");

  useImperativeHandle(ref, () => ({
    exportPNG: () => {
      try {
        return canvasRef.current?.toDataURL("image/png") ?? null;
      } catch {
        return null;
      }
    },
  }));

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
    const cssW = Math.max(200, containerSize.w);
    const cssH = Math.max(220, containerSize.h);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);

    ctx.resetTransform();
    ctx.scale(DPR, DPR);
    ctx.clearRect(0, 0, cssW, cssH);

    // Calculate plate-based gray area
    const totalWcm = Math.max(1, metrics.totalWcm);
    const maxHcm = Math.max(1, metrics.maxHcm);
    const gapsPx = GAP_PX * Math.max(0, plates.length - 1);
    const availW = cssW - OUTER_PAD * 2;
    const availH = cssH - OUTER_PAD * 2;
    const scaleByW = (availW - gapsPx) / totalWcm;
    const scaleByH = availH / maxHcm;
    const scale = Math.max(0.1, Math.min(scaleByW, scaleByH));
    const innerW = totalWcm * scale + gapsPx;
    const innerH = maxHcm * scale;

    const x0 = (cssW - innerW) / 2 - OUTER_PAD / 2;
    const y0 = (cssH - innerH) / 2 - OUTER_PAD / 2;
    const cardW = innerW + OUTER_PAD;
    const cardH = innerH + OUTER_PAD;

    // Soft shadow for the gray area (makes it more realistic)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, x0, y0, cardW, cardH, 18);
    ctx.fillStyle = "#f1f2f4";
    ctx.fill();
    ctx.restore();

    // Light gradient fill for realism
    roundRect(ctx, x0, y0, cardW, cardH, 18);
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + cardH);
    grad.addColorStop(0, "#fafafa");
    grad.addColorStop(1, "#e3e5e9");
    ctx.fillStyle = grad;
    ctx.fill();

    // Inner stroke (soft)
    ctx.save();
    roundRect(ctx, x0, y0, cardW, cardH, 18);
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    const ix = x0 + OUTER_PAD / 2;
    const iy = y0 + OUTER_PAD / 2;

    if (img) {
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(totalWcm * scale));
      off.height = Math.max(1, Math.round(innerH));
      const o = off.getContext("2d")!;
      const tileH = off.height;
      const tileW = Math.max(1, Math.round((img.naturalWidth * tileH) / img.naturalHeight));
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

      let acc = 0;
      const baselineY = iy + innerH;
      plates.forEach((p, idx) => {
        const w = p.widthCm * scale;
        const h = p.heightCm * scale;
        const sx = acc;
        const sy = off.height - h;
        const dx = ix + acc + GAP_PX * idx;
        const dy = baselineY - h;

        ctx.save();
        roundedClip(ctx, dx, dy, w, h, 10);
        ctx.drawImage(off, sx, sy, w, h, dx, dy, w, h);
        ctx.restore();

        // Plate border
        ctx.save();
        roundRect(ctx, dx, dy, w, h, 10);
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        acc += p.widthCm * scale;
      });
    } else {
      ctx.fillStyle = "#cfd3d9";
      ctx.fillRect(ix, iy, innerW, innerH);
    }
  }, [plates, img, containerSize, metrics]);

  return (
    <div className="left" ref={wrapperRef} style={{ position: "relative" }}>
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
          }}
        >
          Remote motif not available — using local image
        </div>
      )}
      <canvas ref={canvasRef} />
    </div>
  );
});

export default PlateCanvas;

/* ---------------- helpers ---------------- */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function roundedClip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRect(ctx, x, y, w, h, r);
  ctx.save();
  ctx.clip();
}
function drawTile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, mirror: boolean) {
  ctx.save();
  if (mirror) {
    ctx.translate(x + w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + w / 2), 0);
  }
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}
