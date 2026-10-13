# Brightness Scroller for GNOME Shell

Use the mouse wheel on the GNOME Top Bar to increase or decrease screen brightness, with GNOME's standard brightness on-screen display.

Settings: step granularity (default 5%), invert scroll direction, an optional required modifier key (Ctrl/Alt/Shift/Super), and a minimum-brightness floor: scrolling never goes below 5% by default, or 1% if "Allow brightness down to 1%" is enabled (very low brightness can make the screen hard to see).

Brightness is controlled via `Main.brightnessManager.globalScale` when the shell provides it (GNOME 48+), otherwise via the `Brightness` property of gnome-settings-daemon's `org.gnome.SettingsDaemon.Power.Screen` D-Bus interface. Requires a backlight-controllable display.

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
