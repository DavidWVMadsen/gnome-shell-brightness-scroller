import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Config from "resource:///org/gnome/shell/misc/config.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const BUS_NAME = "org.gnome.SettingsDaemon.Power";
const OBJECT_PATH = "/org/gnome/SettingsDaemon/Power";
const SCREEN_IFACE = `<node>
  <interface name="org.gnome.SettingsDaemon.Power.Screen">
    <property name="Brightness" type="i" access="readwrite"/>
  </interface>
</node>`;
const ScreenProxy = Gio.DBusProxy.makeProxyWrapper(SCREEN_IFACE);

// Maps the "modifier-key" setting to the Clutter modifier mask(s) that must be held.
const ModifierMasks = {
  none: 0,
  ctrl: Clutter.ModifierType.CONTROL_MASK,
  alt: Clutter.ModifierType.MOD1_MASK,
  shift: Clutter.ModifierType.SHIFT_MASK,
  super: Clutter.ModifierType.SUPER_MASK | Clutter.ModifierType.MOD4_MASK,
};

const [SHELL_MAJOR] = Config.PACKAGE_VERSION.split(".").map(Number);

export default class BrightnessScrollerExtension extends Extension {
  enable() {
    this.settings = this.getSettings();
    this.panel = Main.panel;
    this._proxy = null;

    const setGranularity = () => {
      this.granularity = this.settings.get_int("granularity") / 100.0;
    };
    const setDirection = () => {
      this.direction = this.settings.get_boolean("invert-scroll");
    };
    const setModifier = () => {
      this.modifier_mask = ModifierMasks[this.settings.get_string("modifier-key")] ?? 0;
    };
    setGranularity();
    setDirection();
    setModifier();
    this._settingsIds = [
      this.settings.connect("changed::granularity", setGranularity),
      this.settings.connect("changed::invert-scroll", setDirection),
      this.settings.connect("changed::modifier-key", setModifier),
    ];

    // GNOME 48+: the shell owns brightness (Main.brightnessManager.globalScale).
    // Older: gnome-settings-daemon's Power.Screen D-Bus "Brightness" property.
    this._scale = Main.brightnessManager?.globalScale ?? null;
    if (!this._scale) {
      new ScreenProxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH, (proxy, error) => {
        if (error) {
          console.error(`[brightness-scroller] D-Bus proxy failed: ${error.message}`);
          return;
        }
        if (this.settings) this._proxy = proxy;
      });
    }

    this.scroll_binding = this.panel.connect("scroll-event", this._handle_scroll.bind(this));
  }

  disable() {
    if (this.panel && this.scroll_binding) this.panel.disconnect(this.scroll_binding);
    this.scroll_binding = null;
    this._settingsIds?.forEach((id) => this.settings.disconnect(id));
    this._settingsIds = null;
    this.settings = null;
    this.panel = null;
    this._proxy = null;
    this._scale = null;
  }

  // Returns current brightness as 0..1, or null if unavailable.
  _get_brightness() {
    if (this._scale) return this._scale.value;
    const b = this._proxy?.Brightness;
    if (typeof b !== "number" || b < 0) return null; // -1 => no backlight
    return b / 100;
  }

  _set_brightness(value) {
    if (this._scale) {
      this._scale.value = value;
    } else if (this._proxy) {
      this._proxy.Brightness = Math.round(value * 100);
    }
  }

  _handle_scroll(_actor, event) {
    if (this.modifier_mask && (event.get_state() & this.modifier_mask) === 0) {
      return Clutter.EVENT_PROPAGATE;
    }

    let value = this._get_brightness();
    if (value === null) return Clutter.EVENT_PROPAGATE;

    const multiplier = this.direction ? -1 : 1;
    switch (event.get_scroll_direction()) {
      case Clutter.ScrollDirection.UP:
        value += this.granularity * multiplier;
        break;
      case Clutter.ScrollDirection.DOWN:
        value -= this.granularity * multiplier;
        break;
      default:
        return Clutter.EVENT_PROPAGATE;
    }

    value = Math.clamp(value, 0, 1);
    this._set_brightness(value);
    this._show_osd(value);
    return Clutter.EVENT_STOP;
  }

  _show_osd(value) {
    const icon = Gio.Icon.new_for_string("display-brightness-symbolic");
    if (SHELL_MAJOR >= 49) {
      Main.osdWindowManager.showAll(icon, null, value);
    } else {
      Main.osdWindowManager.show(-1, icon, null, value);
    }
  }
}
