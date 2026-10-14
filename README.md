# Brightness Scroller for GNOME Shell

Use the mouse wheel on the GNOME Top Bar to increase or decrease screen brightness, with GNOME's standard brightness on-screen display.

Settings: step granularity (default 5%), invert scroll direction, an optional required modifier key (Ctrl/Alt/Shift/Super), and a configurable minimum brightness (1–90%, default 5%) that scrolling never goes below (very low values can make the screen hard to see and navigate).

This extension dims in software: it draws a black, click-through overlay on every monitor, with opacity `(1 - level)`. It does not touch the hardware backlight, so it works on any display, including external monitors, but it does not save power. The level is stored in the `dim-level` setting, so it survives re-login and lock. At 100% the overlay is hidden.

The overlay sits directly below the top bar in GNOME Shell's UI stack. Windows, the overview and the lock screen are dimmed. The top bar and its menus, modal dialogs and the brightness OSD stay at full brightness, so you can always scroll back up. Popup windows of apps (for example right-click menus) may not be dimmed.

## Credit

Derived from [Volume Scroller](https://github.com/francislavoie/gnome-shell-volume-scroller) by francislavoie (itself forked from trflynn89's original), via the `modifier-key` branch of DavidWVMadsen's fork. Licensed under the same license (see LICENSE).

## Manual Installation

```bash
cp -r brightness_scroller@davidwvmadsen.github.io ~/.local/share/gnome-shell/extensions/
gnome-extensions enable brightness_scroller@davidwvmadsen.github.io
```

Then log out and back in (Wayland) or restart the shell (X11).

## Contributing

After editing the schema, recompile:

```bash
glib-compile-schemas brightness_scroller@davidwvmadsen.github.io/schemas/
```

## Troubleshooting

```bash
gnome-extensions info brightness_scroller@davidwvmadsen.github.io   # State should be ACTIVE
journalctl -f -o cat /usr/bin/gnome-shell | grep brightness-scroller
```

The extension logs `[brightness-scroller] enable()` on load. The folder name must equal the UUID. On Wayland you have to log out and back in after installing.
