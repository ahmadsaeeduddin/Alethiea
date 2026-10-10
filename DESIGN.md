# Frontend Redesign Prompt for GreenGap (Alethiea)

> **Instructions for the AI Assistant / Developer:**
> You are tasked with executing a complete visual and UI/UX frontend redesign for the **GreenGap** web application. Follow the comprehensive prompt below to elevate the design into a modern, visually stunning, motion-rich, and mobile-friendly application while strictly maintaining every piece of existing functionality and code logic.

---

```markdown
# TASK: Complete Visual Redesign of GreenGap UI/UX

## 1. PROJECT CONTEXT & ARCHITECTURE (DO NOT CHANGE LOGIC)
GreenGap is an explainable urban-greening prioritization web application built with:
- **Framework:** Next.js (App Router, React 19, TypeScript)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`, `src/app/globals.css`)
- **Mapping:** Leaflet & React-Leaflet (dynamic client-side rendering with SSR disabled)
- **Geospatial Processing:** Turf.js (`@turf/turf`)
- **Data & APIs:**
  - `/api/area`: Server-sent streaming events delivering Overpass OpenStreetMap GeoJSON data
  - `/api/geocode`: Nominatim geocoding proxy
- **Existing Routes:**
  - `/`: Area picker landing page (`src/app/page.tsx`, `src/components/AreaPicker.tsx`, `src/components/AreaPickerMap.tsx`)
  - `/explore`: Interactive greening analysis dashboard (`src/app/explore/page.tsx`, `src/components/Dashboard.tsx`, `src/components/MapView.tsx`, `src/components/PriorityPanel.tsx`, `src/components/ZoneDetails.tsx`, `src/components/ImpactComparison.tsx`, `src/components/LoadingSteps.tsx`, `src/components/ExploreGuide.tsx`, `src/components/MapShell.tsx`)

---

## 2. STRICT CONSTRAINTS & PRESERVATION RULES (NO HALLUCINATIONS)
1. **NO FUNCTIONAL BREAKAGE:**
   - Every existing feature, handler, state variable, API call, parameter serialization, coordinate translation, scoring calculation, and scenario simulation MUST remain 100% operational.
   - Do NOT modify mathematical scoring weights (50% green space scarcity, 30% building density, 20% facilities in `src/lib/scoring.ts`).
   - Do NOT modify the 150 m hypothetical greening cluster logic (`src/lib/scenario.ts`).
   - Do NOT break Leaflet map layers, canvas rendering, polygon clicks, or bounds fit logic (`AreaPickerMap.tsx`, `MapView.tsx`, `MapShell.tsx`).
   - Retain full compatibility with URL parameters (`lat`, `lng`, `sizeKm`, `label`).
2. **NO HALLUCINATED FEATURES:**
   - Do NOT invent or add fake backend databases, user authentication (login/signup), mock external APIs, payment gateways, or phantom pages that do not exist.
   - Every visual element must directly serve the real data and workflow of GreenGap (identifying underserved urban zones and testing greening interventions).
3. **STRICT PRESERVATION OF ASSETS & TYPES:**
   - Retain all TypeScript contracts defined in `src/types/index.ts`.
   - Preserve all existing imports, dependencies, and test scripts (`npm run typecheck`, `npm run lint`, `npm run build`).

---

## 3. REDESIGN REQUIREMENTS & SPECIFICATIONS

### A. Navigation, Header & Interactive Menu
- **Global Header Component:**
  - Create a cohesive, sticky glassmorphic navigation header (`backdrop-blur-md bg-white/80 dark:bg-[#123e2a]/80 border-b border-[var(--line)]`).
  - **Brand Mark:** Refined logo badge with dynamic micro-glow and subtle pulse or hover rotation for the icon (`◒`), accompanied by bold typography and category tag.
  - **Navigation Menu & Quick Links:**
    - Desktop: Clean navigation links (e.g., "Overview", "Presets", "Methodology", "Live Analysis") that smoothly scroll to sections or link to pages.
    - Mobile: An accessible, animated slide-out hamburger drawer / sheet menu with fluid enter/exit transitions (`translate-x`, backdrop opacity).
  - **Status Badge:** Redesigned real-time OpenStreetMap connection pill with pulsing status indicator (green when ready, amber during streaming, red on error).
  - Quick action buttons (e.g., "Change Area", "Reset View", "Explore Preset").

### B. Landing Page Hero Section (`/`)
- **Impactful Hero Presentation:**
  - Design a high-impact, modern hero section on the landing page (`AreaPicker.tsx`).
  - **Typography & Headline:** Editorial-grade typography with high-contrast hierarchy, refined letter spacing, and evocative taglines highlighting urban climate resilience and data-driven greening.
  - **Motion Graphics & Visual Atmosphere:**
    - Ambient background motion: Subtle animated radial gradients, soft organic mesh gradients, or faint geometric grid patterns reflecting urban map topology.
    - Floating stats / highlight pills displaying live highlights (e.g., "200m Spatial Grid", "OpenStreetMap Live Integration", "Explainable Priority Scoring").
  - **Structured 3-Step Journey:**
    - Redesign the 3 workflow steps ("1. Choose an area", "2. See the priority grid", "3. Test a greening cluster") with modern card aesthetics, subtle icon glow, animated hover elevations, and connected visual step-lines.

### C. Area Picker & Search Controls
- **Search & Filter Suite:**
  - Modernized search bar with floating label, clear button, active search spinner, and keyboard navigation support.
  - Redesigned Nominatim geocoding dropdown results with smooth fade-in, clean typography, badge markers, and hover states.
  - Lahore Preset Buttons: Interactive card tiles with active indicator ring, micro-badges, and snappy click animations.
  - Study Area Size Selector: Pill-shaped segmented control with sliding active pill highlight animation for 1×1 km, 2×2 km, 3×3 km options.
  - **Action Card & CTA:** High-contrast, glowing action card summarizing the chosen coordinates and bounding box, featuring an animated CTA button with spinner state and arrow transition on hover.

### D. Map Container & Interactive Viewports
- **Map Shell & Card Styling:**
  - Wrap maps (`AreaPickerMap`, `MapView`) in rounded, elevated frames (`rounded-3xl` or `rounded-[32px]`) with subtle borders, inner shadows, and frosted floating overlay controls.
  - **Floating Map Floating Controls:**
    - Floating instruction pills ("⌖ Click anywhere to centre the square") with blur backgrounds and crisp drop shadows.
    - Layer Visibility Control Deck: Redesign the layer toggles ("Priority grid", "Green space", "Buildings", "Schools & hospitals") into a sleek floating floating dock or collapsible badge panel with visual swatches and toggle switches.
  - **Smooth Map Interactions:** Ensure smooth cursor styling (crosshair for area picking, pointer for cell selection) and responsive pinch-to-zoom on mobile devices.

### E. Analysis Dashboard (`/explore`)
- **Metric Cards:**
  - Redesign the summary metrics ("Mapped green spaces", "Analysis grid", "Facilities") with glassmorphic cards, gradient accent lines, metric icons, and skeleton shimmer loaders for the streaming state.
- **Loading Steps & Stream Progress:**
  - Elevate `LoadingSteps.tsx` into an animated telemetry card displaying live streaming status, step completion checkmarks, elapsed timer pill, and animated progress line.
- **Priority Ranking Panel (`PriorityPanel.tsx`):**
  - Smoothly scrollable ranked zone list with priority color tags (Red: Critical need, Amber: Moderate, Light Green: Lower priority).
  - Hover highlights that correlate with map polygons.
  - Filter / sort controls with responsive design.
- **Zone Details & Simulation (`ZoneDetails.tsx` & `ImpactComparison.tsx`):**
  - Interactive inspector for selected cell: score radial/bar meter, raw metric breakdown (distance to park in meters, building count, facility counts), and clear explainable reasoning bullets.
  - Greening intervention simulation button with engaging interactive trigger: "Propose 150m green cluster".
  - Before-and-after comparison view with delta meters, score reductions, and facility impact indicators.

### F. Comprehensive Footer
- Add a complete, polished footer to both the landing page and dashboard:
  - **Brand & Purpose:** GreenGap mission statement and methodology overview.
  - **Data Attribution:** Clear, compliant attribution for OpenStreetMap contributors (ODbL) and Nominatim.
  - **Scientific & Policy Disclaimers:** Explicit transparency notice stating that scores reflect mapped features to guide site investigation, not civil engineering approval.
  - **Tech Stack & Open Source Links:** GitHub repository reference, tech stack badges, and license information.

### G. Responsive UI/UX & Mobile Experience
- **Mobile First Ergonomics:**
  - On viewports < 768px:
    - Stack map and control panels intuitively.
    - Provide bottom sheet / swipeable drawer or tab switcher between "Map View", "Priority Ranking", and "Zone Inspector" to avoid cramped scrolling.
    - All touch targets minimum 44×44px.
    - Search input and preset buttons sized comfortably for thumb navigation.
- **Tablet & Desktop:**
  - Balanced multi-column layouts with independent scroll containers so the map stays sticky while inspecting long lists of cells.

### H. Motion & Animation Standards
- Use modern CSS animations and Tailwind transition utilities:
  - `transition-all duration-300 ease-out`
  - Subtle hover lifts (`hover:-translate-y-0.5 hover:shadow-lg`)
  - Staggered entrance animations for cards and lists (`animate-fade-in`, `animate-slide-up`)
  - Shimmer animations for skeleton states during Overpass streaming
  - All animations MUST respect user preferences via `motion-safe:` and `motion-reduce:transition-none`.

---

## 4. VERIFICATION PLAN (AFTER IMPLEMENTATION)
1. **Type Checking:** Run `npm run typecheck` to verify zero TypeScript errors.
2. **Linting:** Run `npm run lint` to ensure code adheres to ESLint standards.
3. **Build:** Run `npm run build` to confirm production build succeeds without Next.js warnings or regressions.
4. **Functional Checklist:**
   - Landing page place search returns hits and updates the bounding box.
   - Preset buttons update location.
   - Area size selector switches between 1x1, 2x2, and 3x3 km.
   - "Analyse this area" navigates to `/explore` with exact parameters.
   - Explore page streams data, displays progress steps, renders the map grid, allows cell selection, and runs the 150m greening simulation.
   - Responsive layout tested across mobile (375px), tablet (768px), and desktop (1440px).
```

