# Brightness Scroller for GNOME Shell

Use the mouse wheel on the GNOME Top Bar to increase or decrease screen brightness, with GNOME's standard brightness on-screen display.

Settings: step granularity (default 5%), invert scroll direction, an optional required modifier key (Ctrl/Alt/Shift/Super), and a minimum-brightness floor: scrolling never goes below 5% by default, or 1% if "Allow brightness down to 1%" is enabled (very low brightness can make the screen hard to see).

Brightness is controlled via `Main.brightnessManager.globalScale` on GNOME 49+ (where gnome-shell owns the backlight and shows its own brightness OSD), and on GNOME 45-48 via the `Brightness` property of gnome-settings-daemon's `org.gnome.SettingsDaemon.Power.Screen` D-Bus interface. Requires a backlight-controllable display.

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

The extension logs `[brightness-scroller] enable()` on load and a line for each panel scroll. The folder name must equal the UUID. On Wayland you have to log out and back in after installing.
