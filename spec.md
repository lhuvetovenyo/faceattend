# FaceAttend

## Current State

The app currently uses a dark space/sci-fi HUD theme with:
- Very dark navy/black background (`#040b14`) with a starfield canvas animation
- Cyan neon glows (`oklch(0.8 0.18 200)`) on all panels, borders, and text
- HUD corner brackets on panels
- Scanline overlay on the full screen
- Orbitron font for headers and nav labels
- Dark glass panels with very low opacity backgrounds
- The user describes it as "too dark and dirty"

## Requested Changes (Diff)

### Add
- Clean, professional 3D theme that is lighter and more polished
- Cute / friendly emoji or Lucide icons for each panel/section (e.g., Face Scan panel, Dashboard stats, settings sections)
- 3D card depth effects using layered shadows, subtle transforms on hover
- Animated background that is clean and light (soft floating orbs, subtle mesh gradient, or gentle particle field — NOT dark and dirty)
- Polished color system: bright white/light-grey base with one accent color (suggest sky blue or indigo/violet) — professional SaaS look
- Smooth glass cards with white/near-white backgrounds (light glassmorphism)
- Soft drop shadows with color-tinted lift on hover
- Clean typography: Plus Jakarta Sans or Figtree for body, keep a modern display font for headings

### Modify
- index.css: Replace dark OKLCH tokens with clean light-mode professional tokens. Soft white backgrounds, neutral grays, vivid but not neon accent.
- StarfieldCanvas: Replace with a clean animated background (floating soft orbs/blobs or animated mesh gradient — bright and airy, not dark)
- Navbar: Redesign to clean white/frosted glass with subtle border and proper shadow. Remove cyan glow effects. Add clean active states.
- All pages: Remove HUD corner brackets, scanlines, and neon text effects. Replace with clean card shadows and subtle accent borders.
- Panels across Dashboard, FaceScan, Register, Settings: Add cute Lucide icons with colored icon containers next to section titles
- Footer: Keep "Developed by Atoto venyo" but style it clean

### Remove
- Scanline overlay completely
- HUD corner brackets (`.hud-corners`, `.hud-corners-inner`)
- All `neon-text-cyan`, `neon-text-green` classes
- `hud-glow-pulse` and neon flicker animations
- Orbitron font (too sci-fi heavy for clean professional look)
- Dark/dirty color palette

## Implementation Plan

1. **index.css**: Replace entire OKLCH token set with clean professional light palette. Background: near-white (oklch ~0.98). Foreground: dark slate. Primary: rich blue/indigo. Cards: pure white with subtle border. Add new utility classes for 3D card effects, smooth hover lifts.
2. **StarfieldCanvas.tsx**: Replace starfield with `AnimatedBackground.tsx` — soft pastel gradient orbs floating (CSS animation + canvas or pure CSS), bright and airy.
3. **Navbar.tsx**: White frosted glass navbar, clean active state with indigo underline, Lucide icons for each nav item, remove all cyan neon styling.
4. **App.tsx**: Remove scanline overlay div, reference new AnimatedBackground component.
5. **Pages**: Update panel/card styling — white glass cards with soft shadows, cute icon badges for each panel header. Remove HUD utility class usage.
