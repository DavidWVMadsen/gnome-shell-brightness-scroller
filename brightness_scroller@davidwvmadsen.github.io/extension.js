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
const TAG = "[brightness-scroller]";

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
    const setMinimum = () => {
      this.min_brightness = this.settings.get_boolean("allow-low-brightness") ? 0.01 : 0.05;
    };
    setMinimum();
    setGranularity();
    setDirection();
    setModifier();
    this._settingsIds = [
      this.settings.connect("changed::granularity", setGranularity),
      this.settings.connect("changed::invert-scroll", setDirection),
      this.settings.connect("changed::modifier-key", setModifier),
      this.settings.connect("changed::allow-low-brightness", setMinimum),
    ];

    // GNOME 49+: gnome-shell owns the backlight (js/misc/brightnessManager.js) and
    // gnome-settings-daemon 49+ no longer exports Power.Screen. GNOME 45-48 use
    // the gsd Power.Screen D-Bus "Brightness" property.
    this._useManager = !!Main.brightnessManager;
    console.log(`${TAG} enable(): GNOME ${Config.PACKAGE_VERSION}, backend=${this._useManager ? "Main.brightnessManager" : "gsd Power.Screen D-Bus"}, modifier=${this.settings.get_string("modifier-key")}`);
    if (this._useManager) {
      if (!Main.brightnessManager.globalScale)
        console.warn(`${TAG} brightnessManager has no globalScale yet (no backlight-capable monitor detected)`);
    } else {
      new ScreenProxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH, (proxy, error) => {
        if (error) {
          console.warn(`${TAG} D-Bus proxy for ${BUS_NAME} failed: ${error.message}`);
          return;
        }
        if (this.settings) this._proxy = proxy;
      });
    }

    this.scroll_binding = this.panel.connect("scroll-event", this._handle_scroll.bind(this));
    console.log(`${TAG} scroll handler attached to Main.panel (id ${this.scroll_binding})`);
  }

  disable() {
    if (this.panel && this.scroll_binding) this.panel.disconnect(this.scroll_binding);
    this.scroll_binding = null;
    this._settingsIds?.forEach((id) => this.settings.disconnect(id));
    this._settingsIds = null;
    this.settings = null;
    this.panel = null;
    this._proxy = null;
    console.log(`${TAG} disable()`);
  }

  // Looked up on every use: the manager recreates globalScale when monitors change.
  get _scale() {
    return this._useManager ? (Main.brightnessManager?.globalScale ?? null) : null;
  }

  // Returns current brightness as 0..1, or null if unavailable.
  _get_brightness() {
    if (this._useManager) {
      const scale = this._scale;
      if (!scale) console.warn(`${TAG} no Main.brightnessManager.globalScale (no backlight-capable monitor?)`);
      return scale ? scale.value : null;
    }
    if (!this._proxy) {
      console.warn(`${TAG} D-Bus proxy not available`);
      return null;
    }
    const b = this._proxy.Brightness;
    if (typeof b !== "number" || b < 0) { // -1 => no backlight
      console.warn(`${TAG} gsd reports no usable Brightness (${b})`);
      return null;
    }
    return b / 100;
  }

  _set_brightness(value) {
    if (this._useManager) {
      const scale = this._scale;
      if (scale) scale.value = value;
    } else if (this._proxy) {
      // D-Bus uses integer percent; floor is 5 (or 1) to match globalScale.
      this._proxy.Brightness = Math.clamp(Math.round(value * 100), Math.round(this.min_brightness * 100), 100);
    }
  }

  _handle_scroll(_actor, event) {
    console.log(`${TAG} scroll-event received (direction ${event.get_scroll_direction()}, state 0x${event.get_state().toString(16)})`);
    if (this.modifier_mask && (event.get_state() & this.modifier_mask) === 0) {
      console.debug(`${TAG} scroll ignored: modifier not held`);
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

    value = Math.clamp(value, this.min_brightness, 1);
    console.log(`${TAG} scroll -> brightness ${Math.round(value * 100)}%`);
    try {
      this._set_brightness(value);
      // On 49+ the brightness manager shows its own per-monitor OSD when
      // globalScale changes; showing ours too would double it.
      if (!this._useManager) this._show_osd(value);
    } catch (e) {
      console.warn(`${TAG} failed to set brightness: ${e}`);
    }
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
