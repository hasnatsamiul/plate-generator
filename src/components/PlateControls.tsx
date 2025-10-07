import type { Plate, LocaleFlavor } from "../types";
import NumberField from "./NumberField";

type Props = {
  plates: Plate[];
  setPlate: (id: string, data: Partial<Plate>) => void;
  addPlate: () => void;
  removePlate: (id: string) => void;
  reorderPlates?: (fromIndex: number, toIndex: number) => void; // optional
  loc: LocaleFlavor;
  unit?: "cm" | "in";
  limits?: {
    widthMin: number; widthMax: number;
    heightMin: number; heightMax: number;
  };
  toDisplay?: (cm: number) => number; // optional; defaults to identity
};

export default function PlateControls({
  plates,
  setPlate,
  addPlate,
  removePlate,
  reorderPlates,
  loc,
  unit = "cm",
  limits = { widthMin: 20, widthMax: 300, heightMin: 30, heightMax: 128 },
  toDisplay = (x) => x,
}: Props) {
  // simple drag & drop (only active if reorderPlates provided)
  let dragIndex: number | null = null;
  const onDragStart = (i: number) => { dragIndex = i; };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (i: number) => {
    if (reorderPlates && dragIndex !== null && dragIndex !== i) {
      reorderPlates(dragIndex, i);
    }
    dragIndex = null;
  };

  return (
    <div className="right">
      {/* --- Title exactly above the editing cards --- */}
      <div className="title" style={{ margin: "0 0 12px 6px" }}>
        Maße. <span className="muted">Eingeben.</span>
      </div>

      {/* --- Real plate cards only --- */}
      {plates.map((p, i) => {
        const wDisp = Math.round(toDisplay(p.widthCm) * 10) / 10;
        const hDisp = Math.round(toDisplay(p.heightCm) * 10) / 10;

        return (
          <div
            key={p.id}
            className="group"
            draggable={!!reorderPlates}
            onDragStart={() => onDragStart(i)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(i)}
          >
            <div className="group-head">{i + 1}</div>
            <div className="row">
              <NumberField
                label={`Breite (${unit})`}
                value={wDisp}
                min={limits.widthMin}
                max={limits.widthMax}
                loc={loc}
                onCommit={(n: number) => setPlate(p.id, { widthCm: n })}
                unit={unit}
              />
              <span className="times">×</span>
              <NumberField
                label={`Höhe (${unit})`}
                value={hDisp}
                min={limits.heightMin}
                max={limits.heightMax}
                loc={loc}
                onCommit={(n: number) => setPlate(p.id, { heightCm: n })}
                unit={unit}
              />
              <button
                className="icon danger"
                onClick={() => removePlate(p.id)}
                disabled={plates.length === 1}
                title="Entfernen"
                aria-label="Entfernen"
              >
                −
              </button>
            </div>
          </div>
        );
      })}

      <button className="add" onClick={() => addPlate()}>
        Rückwand hinzufügen  +
      </button>
    </div>
  );
}
