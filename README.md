# Plate Generator System

A responsive web application for configuring and visualizing custom wall plates.  
Users can add, resize, reorder, and preview plates that each display a portion of a shared background motif.  
Developed as part of the Rueckwand24 Frontend Technical Assessment.

---

## Live Demo

**https://plate-generator-umber.vercel.app/**

_(Deployed on Vercel)_

---

## Features

- **Automatic Default Plate**

  - Automatically creates one default plate (250 cm × 128 cm) on load with a predefined motif.

- **Persistent Configuration**

  - All plates and settings are stored in browser `localStorage` and restored after reload.

- **Customizable Dimensions**

  - Adjustable width (20 – 300 cm) and height (30 – 128 cm) per plate.

- **Locale-Aware Numeric Input**

  - Supports both English (`.`) and German (`,`) decimal separators.
  - Real-time validation with clear error messages for invalid or out-of-range values.

- **Dynamic Plate Management**

  - Add new plates (up to 10).
  - Remove any plate except the last one.
  - Drag and drop to reorder plates visually.

- **Canvas Visualization**

  - Accurate proportional preview at **1 cm = 1 px**.
  - Plates displayed side-by-side with realistic shadows and rounded corners.
  - Canvas resizes responsively without distortion.

- **Motif Image Rendering**

  - Shared motif extends across all plates proportionally.
  - Automatic mirroring when total width > 300 cm for seamless continuity.
  - Fallback chain: _user upload → remote motif → local asset_.

- **Image Upload**

  - Upload a custom motif from your device; updates preview instantly.

- **Unit Toggle**

  - Switch between **centimeters (cm)** and **inches (in)** with automatic conversion.

- **Export Preview**

  - Export the current layout as a **PNG** image.

- **Responsive & Mobile-Friendly**
  - Desktop: canvas (left) and controls (right).
  - Mobile: stacked layout with canvas on top.
  - Touch-optimized interface throughout.

---

## Tech Stack

- **React + TypeScript**
- **Vite** (bundler)
- **HTML Canvas API**
- **CSS3 / Flexbox / Media Queries**
- **LocalStorage API**
- **Vercel** (deployment)

---

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/hasnatsamiul/plate-generator.git
cd plate-generator

# 2. Install dependencies
npm install

# 3. Run locally
npm run dev
#  open http://localhost:5173

# 4. Build for production
npm run build

# 5. Preview production build
npm run preview
```
