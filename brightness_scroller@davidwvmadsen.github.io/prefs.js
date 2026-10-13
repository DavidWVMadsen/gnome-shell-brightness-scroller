import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BrightnessScrollerExtensionPreferences extends ExtensionPreferences {
   fillPreferencesWindow(window) {
    window._settings = this.getSettings();

    // Create a preferences page and group
    const page = new Adw.PreferencesPage();
    const group = new Adw.PreferencesGroup();
    page.add(group);

    // Create the preference rows
    const granularityRow = new Adw.ActionRow({ title: 'Granularity' });
    const invertScrollRow = new Adw.ActionRow({ title: 'Invert Scroll' });
    group.add(granularityRow);
    group.add(invertScrollRow);

    // Allow very low brightness switch
    const lowBrightnessRow = new Adw.ActionRow({
      title: 'Allow brightness down to 1%',
      subtitle: 'By default the minimum is 5%. Very low brightness can make the screen hard to see and navigate (the top bar stays bright so you can scroll back up).',
    });
    const lowBrightnessSwitch = new Gtk.Switch({
      active: window._settings.get_boolean('allow-low-brightness'),
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });
    window._settings.bind('allow-low-brightness', lowBrightnessSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
    lowBrightnessRow.add_suffix(lowBrightnessSwitch);
    lowBrightnessRow.activatable_widget = lowBrightnessSwitch;
    group.add(lowBrightnessRow);

    // Create the modifier key dropdown
    const modifierKeys = ['none', 'ctrl', 'alt', 'shift', 'super'];
    const modifierRow = new Adw.ComboRow({
      title: 'Required modifier key',
      subtitle: 'Only change brightness on scroll while this key is held',
      model: Gtk.StringList.new(['None', 'Ctrl', 'Alt', 'Shift', 'Super']),
      selected: Math.max(0, modifierKeys.indexOf(window._settings.get_string('modifier-key'))),
    });
    group.add(modifierRow);

    // Create the value picker
    const granularityEntry = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({ step_increment: 1, lower: 1, upper: 50 }),
      value: window._settings.get_int('granularity'),
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });

    // Create the direction switch
    const invertScrollSwitch = new Gtk.Switch({
      active: window._settings.get_boolean('invert-scroll'),
      valign: Gtk.Align.CENTER,
      halign: Gtk.Align.CENTER,
    });

    // Bind the settings
    window._settings.bind(
      'granularity',
      granularityEntry,
      'value',
      Gio.SettingsBindFlags.DEFAULT
    );
    
    window._settings.bind(
      'invert-scroll',
      invertScrollSwitch,
      'active',
      Gio.SettingsBindFlags.DEFAULT
    );

    modifierRow.connect('notify::selected', () => {
      window._settings.set_string('modifier-key', modifierKeys[modifierRow.selected]);
    });
    window._settings.connect('changed::modifier-key', () => {
      modifierRow.selected = Math.max(0, modifierKeys.indexOf(window._settings.get_string('modifier-key')));
    });

    // Add the granularity value picker to the row
    granularityRow.add_suffix(granularityEntry);
    granularityRow.activatable_widget = granularityEntry;

    // Add the direction switch to the row
    invertScrollRow.add_suffix(invertScrollSwitch);
    invertScrollRow.activatable_widget = invertScrollSwitch;

    // Add our page to the window
    window.add(page);
  }
}
