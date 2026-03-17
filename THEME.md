# Aethel Theme — Minimalist Pane Design

> Radical reduction. Let the content breathe. Every element earns its place.

## Philosophy

Remove until it breaks, then add one thing back. No decoration — only information. Whitespace is the primary design element. The interface should feel like a well-typeset page, not a dashboard.

## Page Shell

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #faf9f7;            /* warm off-white, not cool gray */
  -webkit-font-smoothing: antialiased;
}
```

Load Inter for body text:
```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
```

## Color Palette

| Token | Value | Use |
|-------|-------|-----|
| `--text` | `#1a1a1a` | Primary text |
| `--text-muted` | `#999` | Subtitles, dates |
| `--text-faint` | `#bbb` | Completed items |
| `--text-ghost` | `#ccc` | Section headers |
| `--border` | `#d4d4d4` | Checkbox borders |
| `--border-light` | `#e5e5e5` | Category pill borders |
| `--border-warm` | `#f0ede8` | Section dividers |
| `--bg` | `#faf9f7` | Page background |
| `--danger` | `#e55` | Delete hover |
| `--check-fill` | `#1a1a1a` | Checked checkbox |

No brand colors. No state-specific colors. Monochrome by default.

## Typography

### Heading — serif italic
```
font-family: Georgia, "Times New Roman", serif
font-size: 36px
font-weight: 400
font-style: italic
color: #1a1a1a
letter-spacing: -0.5px
```

### Body text — sans-serif
```
font-family: Inter, system-ui, sans-serif
font-size: 14px
font-weight: 400
color: #1a1a1a
line-height: 1.4
```

### Section labels — uppercase
```
font-size: 11px
font-weight: 600
color: #ccc
letter-spacing: 0.1em
text-transform: uppercase
```

## Layout

- **Max width:** 640px, centered
- **Padding:** 48px top, 40px sides, 80px bottom
- **No cards.** No borders. No colored backgrounds. Items are rows in open space.
- **Generous vertical rhythm:** 14px row padding, 48px after subtitle, 40px between sections

## Components

### Task Row

A single flex row: checkbox → title → category pill → delete button.

```
display: flex
align-items: center
gap: 16px
padding: 14px 0
```

No background, no border, no border-radius. The row IS the item.

### Checkbox

**Unchecked:**
```
width: 20px; height: 20px
border-radius: 5px
border: 1.5px solid #d4d4d4
background: transparent
```

**Checked:**
```
background: #1a1a1a
border: none
```
Contains a white `✓` (13px, weight 600).

Hover darkens border to `#999`. No other animation.

### Category Pill

```
font-size: 11px
color: #888
border: 1px solid #e5e5e5
border-radius: 4px
padding: 2px 10px
```

Only shown on active (uncompleted) items. Right-aligned.

### Delete Button

Hidden by default (`opacity: 0`). Appears on row hover. Color `#ddd` → `#e55` on hover.

```
font-size: 13px
character: ✕
```

### Add Input

Invisible until focused. No visible border, no background. On focus, a subtle bottom border appears.

```
border: none
border-bottom: 1px solid transparent
font: 400 14px/2.4 inherit
background: transparent
```

Focus: `border-bottom-color: #ddd`

Submits on Enter. No button.

## Grouping

Items are split into two groups — no filter tabs, no progress bar, no stats strip.

1. **Active items** — all non-shipped issues, rendered as rows
2. **"COMPLETED" section** — preceded by:
   - A thin warm border (`1px solid #f0ede8`)
   - An uppercase label: `COMPLETED` in `#ccc`
   - Completed items: struck-through title in `#bbb`, no category pill

## Subtitle

Dynamic, counts active tasks:
- `"You have 3 tasks remaining."`
- `"All clear."` when empty

Style: `14px`, `#999`, `400` weight.

## Interactions

| Interaction | Behavior |
|-------------|----------|
| Click checkbox | Cycles state: To Do → In Progress → Works → Released |
| Enter in input | Adds new issue with `wf:initialState` |
| Hover row | Shows delete button (fade in) |
| Hover checkbox | Border darkens |
| Drag row | Reorder within `wf:issue` array, auto-saves |

## What This Theme Removes

- Progress bars
- Stats strips (total/active/done counts)
- Filter tabs
- Card backgrounds and borders
- Colored state indicators (left borders, dots)
- State badge pills
- Drag handles (rows are draggable directly)
- Add button (Enter key only)
- Save button (auto-save, silent)
- Description text in list view
- Date stamps in list view

## Shell Tab Overrides

The LOSOS shell sets inline tab styles. Override with `!important`:

```css
button.pane-tab { color: #64748b !important; font-weight: 500 !important; }
button.pane-tab:hover { color: #0f172a !important; }
button.pane-tab[aria-selected="true"] { color: #6366f1 !important; font-weight: 600 !important; }
```

## When to Use This Theme

Best for personal task lists, reading lists, journals — anywhere the content is short-form text and the user values calm over information density. Not ideal for large team trackers where state visibility and filtering matter.
