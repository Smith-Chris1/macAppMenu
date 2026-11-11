# Mac App Menu for Cinnamon

A native Cinnamon panel applet providing a macOS-style horizontal top menu bar:
`[Active App Name]  [Edit]  [View]  [Window]  [Help]`

Unlike standard window lists, each menu sits horizontally side-by-side on the panel, responds to individual hover states, and expands a flush, left-aligned dropdown menu.

---

## Features

- **Active Application Title**: Displays the currently focused application's name (or "Finder" / "Desktop" when unfocused). Drops down to minimize, close, or quit all instances of the application.
- **Edit Menu**: Provides system clipboard and editing actions (`Undo`, `Redo`, `Cut`, `Copy`, `Paste`, `Select All`) piped into the active window via keystroke injection.
- **View Menu**: Quick window placement controls:
  - Fullscreen toggle (`F11`)
  - Maximize / Restore toggle
  - Minimize
  - Half-screen snap: Left, Right, Top, Bottom
- **Window Menu**: Lists every open window belonging to the focused application with a checkmark (`✓`) on the active instance, allows one-click switching between them, and includes a "Bring All to Front" action.
- **Help Menu**: Launches local application documentation (`yelp`) or queries the targeted application's documentation in your default web browser.
- **Pixel-Accurate Alignment**: Custom `BoxPointer` layout overrides force dropdowns to align flush against the bottom panel with no floating gap and strict left alignment to each button.

---

## Dependencies

The applet runs inside Cinnamon's native CJS environment (`cinnamon`, `cjs`, `gir1.2-gtk-3.0`, `gir1.2-st-1.0`), but relies on `xdotool` to simulate keyboard combinations for the **Edit** menu.

### 1. Install System Requirements

Open a terminal and run:

```bash
sudo apt update
sudo apt install xdotool yelp
```

