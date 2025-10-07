import { useCallback, useMemo, useEffect, useRef } from "react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { Plate, LocaleFlavor } from "./types";
import { detectLocale } from "./utils/locale";
import PlateCanvas, { PlateCanvasHandle } from "./components/PlateCanvas";
import PlateControls from "./components/PlateControls";

const DEFAULT_PLATE: Plate = {
  id: crypto.randomUUID(),
  widthCm: 250,
  heightCm: 128,
};

type Persisted = {
  plates: Plate[];
  loc: LocaleFlavor;
  unit: "cm" | "in";
  motifSrc?: string | null;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function App() {
  const [state, setState] = useLocalStorage<Persisted>("plate-generator:v1", {
    plates: [DEFAULT_PLATE],
    loc: detectLocale(),
    unit: "cm",
    motifSrc: null,
  });

  const canvasRef = useRef<PlateCanvasHandle>(null);

  // Ensure a default plate always exists
  useEffect(() => {
    if (state.plates.length === 0) {
      setState((s) => ({ ...s, plates: [DEFAULT_PLATE] }));
    }
  }, [state.plates, setState]);

  // Fix missing or duplicate IDs
  useEffect(() => {
    const seen = new Set<string>();
    let changed = false;
    const repaired = state.plates.map((p) => {
      let id = p.id;
      if (!id || seen.has(id)) {
        id = crypto.randomUUID();
        changed = true;
      }
      seen.add(id);
      return { ...p, id };
    });
    if (changed) setState((s) => ({ ...s, plates: repaired }));
  }, [state.plates, setState]);

  // ---- Actions ----
  const setPlate = useCallback(
    (id: string, data: Partial<Plate>) => {
      setState((s) => ({
        ...s,
        plates: s.plates.map((p) => (p.id === id ? { ...p, ...data } : p)),
      }));
    },
    [setState]
  );

  const addPlate = useCallback(
    (initial?: { widthCm: number; heightCm: number }) => {
      setState((s) => {
        if (s.plates.length >= 10) return s;
        const last = s.plates[s.plates.length - 1] ?? DEFAULT_PLATE;
        const w = initial ? initial.widthCm : last.widthCm;
        const h = initial ? initial.heightCm : last.heightCm;
        const next: Plate = {
          id: crypto.randomUUID(),
          widthCm: clamp(w, 20, 300),
          heightCm: clamp(h, 30, 128),
        };
        return { ...s, plates: [...s.plates, next] };
      });
    },
    [setState]
  );

  const removePlate = useCallback(
    (id: string) => {
      setState((s) => {
        if (s.plates.length <= 1) return s;
        return { ...s, plates: s.plates.filter((p) => p.id !== id) };
      });
    },
    [setState]
  );

  const reorderPlates = useCallback(
    (from: number, to: number) => {
      setState((s) => {
        const arr = [...s.plates];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        return { ...s, plates: arr };
      });
    },
    [setState]
  );

  const totalWidth = useMemo(
    () => state.plates.reduce((sum, p) => sum + p.widthCm, 0),
    [state.plates]
  );

  // ---- Motif Upload ----
  const onMotifFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      setState((s) => ({ ...s, motifSrc: url }));
    },
    [setState]
  );

  // ---- Export ----
  const exportPNG = () => {
    const data = canvasRef.current?.exportPNG();
    if (data) {
      const a = document.createElement("a");
      a.href = data;
      a.download = "plates_preview.png";
      a.click();
    }
  };

  // ---- Unit conversion ----
  const cmToIn = (cm: number) => cm / 2.54;
  // const inToCm = (inch: number) => inch * 2.54;
  const toDisplay = (cm: number) => (state.unit === "in" ? cmToIn(cm) : cm);

  return (
    <div className="app">
      {/* ======= Title above panels ======= */}
      <div className="main-header">
        <div className="title">
          {/* Maße. <span className="muted">Eingeben.</span> */}
        </div>
      </div>

      {/* ======= Main Split Layout ======= */}
      <main className="split">
        {/* Left: Canvas */}
        <PlateCanvas ref={canvasRef} plates={state.plates} motifSrc={state.motifSrc} />

        {/* Right: Controls and toolbar */}
        <div className="right-panel">
          <div className="toolbar">
            
            {/* Language */}
            <div className="segmented" role="group" aria-label="Language">
              <button
                className={`seg-btn ${state.loc === "de" ? "active" : ""}`}
                onClick={() => setState((s) => ({ ...s, loc: "de" }))}
              >
                DE
              </button>
              <button
                className={`seg-btn ${state.loc === "en" ? "active" : ""}`}
                onClick={() => setState((s) => ({ ...s, loc: "en" }))}
              >
                EN
              </button>
            </div>

            {/* Units */}
            <div className="segmented" role="group" aria-label="Units">
              <button
                className={`seg-btn ${state.unit === "cm" ? "active" : ""}`}
                onClick={() => setState((s) => ({ ...s, unit: "cm" }))}
              >
                cm
              </button>
              <button
                className={`seg-btn ${state.unit === "in" ? "active" : ""}`}
                onClick={() => setState((s) => ({ ...s, unit: "in" }))}
              >
                in
              </button>
            </div>

            {/* Upload motif */}
            <label className="btn ghost">
              Upload motif
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onMotifFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>

            {/* Export PNG */}
            <button className="btn primary" onClick={exportPNG}>
              Export PNG
            </button>
          </div>

          {/* Plate Controls */}
          <PlateControls
            plates={state.plates}
            setPlate={setPlate}
            addPlate={addPlate}
            removePlate={removePlate}
            reorderPlates={reorderPlates}
            loc={state.loc}
            unit={state.unit}
            limits={{ widthMin: 20, widthMax: 300, heightMin: 30, heightMax: 128 }}
            toDisplay={toDisplay}
          />
        </div>
      </main>

      {/* ======= Footer ======= */}
      <footer>
        <small>
          1 cm = 1 px preview · Image mirrors when total width &gt; 300 cm · Plates:{" "}
          {state.plates.length} / 10 · Total width: {totalWidth.toFixed(1)} cm
        </small>
      </footer>
    </div>
  );
}
