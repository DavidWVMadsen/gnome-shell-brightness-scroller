import Clutter from "gi://Clutter";
import Gio from "gi://Gio";
import St from "gi://St";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as Config from "resource:///org/gnome/shell/misc/config.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

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

/*
 * Software dimming: a black, non-reactive overlay per monitor whose opacity is
 * (1 - level) * 255. It is inserted in Main.layoutManager.uiGroup directly below
 * panelBox, so it covers windows, the overview and the lock screen, but the top
 * bar, its menus, modal dialogs and the OSD (all stacked above panelBox) stay
 * at full brightness and you can always scroll back up. The overlays are not
 * registered with addChrome(), so they are not part of the input region, and
 * reactive:false lets every click/scroll pass through.
 */
export default class BrightnessScrollerExtension extends Extension {
  enable() {
    this.settings = this.getSettings();
    this._overlays = [];
    this._smooth_acc = 0;

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
      this.min_level = this.settings.get_boolean("allow-low-brightness") ? 0.01 : 0.05;
      // Re-apply in case the floor was raised.
      this._apply(this._get_level());
    };
    setGranularity();
    setDirection();
    setModifier();
    this.min_level = this.settings.get_boolean("allow-low-brightness") ? 0.01 : 0.05;

    this._settingsIds = [
      this.settings.connect("changed::granularity", setGranularity),
      this.settings.connect("changed::invert-scroll", setDirection),
      this.settings.connect("changed::modifier-key", setModifier),
      this.settings.connect("changed::allow-low-brightness", setMinimum),
    ];

    this._monitorsId = Main.layoutManager.connect("monitors-changed", () => this._rebuild_overlays());
    this._rebuild_overlays();

    this.scroll_binding = Main.panel.connect("scroll-event", this._handle_scroll.bind(this));
    console.log(`${TAG} enable(): GNOME ${Config.PACKAGE_VERSION}, overlay dimming, level=${Math.round(this._get_level() * 100)}%`);
  }

  disable() {
    if (this.scroll_binding) Main.panel.disconnect(this.scroll_binding);
    this.scroll_binding = null;
    if (this._monitorsId) Main.layoutManager.disconnect(this._monitorsId);
    this._monitorsId = null;
    this._destroy_overlays();
    this._overlays = null;
    this._settingsIds?.forEach((id) => this.settings.disconnect(id));
    this._settingsIds = null;
    this.settings = null;
    console.log(`${TAG} disable()`);
  }

  _get_level() {
    return Math.clamp(this.settings.get_double("dim-level"), this.min_level, 1);
  }

  _destroy_overlays() {
    for (const o of this._overlays ?? []) o.destroy();
    this._overlays = [];
  }

  _rebuild_overlays() {
    this._destroy_overlays();
    const uiGroup = Main.layoutManager.uiGroup;
    const panelBox = Main.layoutManager.panelBox;
    for (const m of Main.layoutManager.monitors) {
      const overlay = new St.Widget({
        name: "brightnessScrollerOverlay",
        style: "background-color: black;",
        reactive: false,
        can_focus: false,
        track_hover: false,
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
        opacity: 0,
        visible: false,
      });
      if (panelBox && panelBox.get_parent() === uiGroup) {
        uiGroup.insert_child_below(overlay, panelBox);
      } else {
        console.warn(`${TAG} panelBox not in uiGroup; adding overlay below top_window_group`);
        uiGroup.insert_child_below(overlay, global.top_window_group);
      }
      this._overlays.push(overlay);
    }
    this._apply(this._get_level());
  }

  _apply(level) {
    const opacity = Math.round((1 - level) * 255);
    for (const o of this._overlays ?? []) {
      o.opacity = opacity;
      o.visible = opacity > 0;
    }
  }

  _handle_scroll(_actor, event) {
    if (this.modifier_mask && (event.get_state() & this.modifier_mask) === 0) {
      return Clutter.EVENT_PROPAGATE;
    }

    // +1 = up, -1 = down. Smooth scroll events (touchpads, hi-res wheels) are
    // accumulated so one wheel notch counts as one step.
    let dir = 0;
    switch (event.get_scroll_direction()) {
      case Clutter.ScrollDirection.UP:
        dir = 1;
        break;
      case Clutter.ScrollDirection.DOWN:
        dir = -1;
        break;
      case Clutter.ScrollDirection.SMOOTH: {
        const [, dy] = event.get_scroll_delta();
        this._smooth_acc -= dy;
        if (Math.abs(this._smooth_acc) < 1) return Clutter.EVENT_STOP;
        dir = Math.sign(this._smooth_acc);
        this._smooth_acc = 0;
        break;
      }
      default:
        return Clutter.EVENT_PROPAGATE;
    }

    const multiplier = this.direction ? -1 : 1;
    let level = this._get_level() + dir * this.granularity * multiplier;
    level = Math.clamp(Math.round(level * 100) / 100, this.min_level, 1);

    try {
      this.settings.set_double("dim-level", level);
      this._apply(level);
      this._show_osd(level);
    } catch (e) {
      console.warn(`${TAG} failed to apply dim level: ${e}`);
    }
    return Clutter.EVENT_STOP;
  }

  _show_osd(level) {
    const icon = Gio.Icon.new_for_string("display-brightness-symbolic");
    if (SHELL_MAJOR >= 49) {
      Main.osdWindowManager.showAll(icon, null, level);
    } else {
      Main.osdWindowManager.show(-1, icon, null, level);
    }
  }
}
