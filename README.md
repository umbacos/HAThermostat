# HA Thermostat

A smart thermostat custom integration for [Home Assistant](https://www.home-assistant.io/) that controls a boiler switch based on a temperature sensor. Supports manual mode with optional expiry and fully configurable weekly schedules built from reusable "day type" templates.

---

## Features

- **Manual mode** — set a target temperature with an optional end date/time; the thermostat automatically reverts to the schedule when the time expires
- **Weekly schedule** — assign a *day type* to each day of the week (Mon–Sun)
- **Day types** — reusable 24-slot hourly templates (Off / Comfort / Eco) with three built-in presets and support for unlimited custom ones
- **Hysteresis control** — ±0.5 °C dead-band prevents boiler short-cycling
- **Lovelace card** — compact dashboard card for quick control
- **Full-page panel** — dedicated sidebar panel for schedule and day-type management
- **Bilingual UI** — Italian and English, auto-detected from the Home Assistant locale setting
- **No cloud dependency** — 100% local, no external libraries required

---

## Screenshots

> _Add screenshots here after installation_

---

## Requirements

| Requirement | Notes |
|---|---|
| Home Assistant | 2023.6 or newer recommended |
| Boiler switch entity | Any `switch.*` entity that turns the boiler on/off |
| Temperature sensor | Any `sensor.*` entity with `device_class: temperature` |

---

## Installation

### Option A — Manual (recommended for first install)

1. **Download** the latest release zip from the [Releases page](../../releases) (`ha_thermostat.zip`)

2. **Extract** the zip. You will find two folders:
   ```
   custom_components/ha_thermostat/
   www/ha_thermostat/
   ```

3. **Copy** the folders into your Home Assistant configuration directory:
   ```
   /config/custom_components/ha_thermostat/
   /config/www/ha_thermostat/
   ```
   > On Home Assistant OS you can use the **Samba share** add-on or the **File editor** add-on to upload files.

4. **Restart Home Assistant** (Settings → System → Restart)

### Option B — HACS (coming soon)

Support for installation via [HACS](https://hacs.xyz/) is planned.

---

## Configuration

### Step 1 — Add the integration

Go to **Settings → Integrations → Add Integration** and search for **HA Thermostat**.

Fill in the setup form:

| Field | Description |
|---|---|
| Integration name | Display name (default: `HA Thermostat`) |
| Boiler switch entity | The `switch.*` entity that controls your boiler |
| Temperature sensor entity | The `sensor.*` entity that reads room temperature |
| Comfort temperature | Target temperature for "Comfort" slots (default: 21 °C) |
| Eco temperature | Target temperature for "Eco" slots (default: 18 °C) |

### Step 2 — Add the Lovelace card

Edit your dashboard and add a **Manual card** with the following YAML:

```yaml
type: custom:ha-thermostat-card
entity: climate.ha_thermostat
```

> If the card does not appear, make sure the browser cache is cleared (Ctrl+Shift+R).

### Step 3 — Register the frontend resource (if needed)

If the card does not load automatically, add the resource manually in **Settings → Dashboards → Resources**:

| URL | Type |
|---|---|
| `/local/ha_thermostat/ha-thermostat-card.js` | JavaScript Module |

---

## Usage

### Lovelace card

The dashboard card shows:

- Current temperature (from the sensor)
- Target temperature
- Boiler state (ON / OFF)
- Active mode badge (Manual / Schedule)
- Manual mode expiry time (when set)
- Temperature +/− controls
- Optional end date/time picker for manual mode
- Quick buttons: **Set temperature** (activates manual mode) and **Back to schedule**
- **Configure** button — opens the full-page panel

### Full-page panel

Access the panel from the Home Assistant sidebar: **HA Thermostat**.

The panel has four sections:

#### General settings
Change the comfort and eco temperatures that apply globally to all schedule slots. The boiler switch and sensor entities are shown for reference (change them by removing and re-adding the integration).

#### Day types
Manage reusable 24-hour templates. Each hour slot cycles through three states with a single click:

| State | Colour | Meaning |
|---|---|---|
| Off | Grey | Boiler disabled for this hour |
| Comfort | Orange | Target = comfort temperature |
| Eco | Blue | Target = eco temperature |

**Built-in day types** (cannot be deleted):

| ID | Default name |
|---|---|
| `workday` | Giornata lavorativa / Workday |
| `vacation` | Tutti in vacanza / All on vacation |
| `someone_home` | Qualcuno a casa / Someone home |

Use **Add day type** to create custom templates and **Edit / Delete** to manage them.

#### Weekly schedule
Assign a day type to each day of the week using the dropdown. Select **Atypical** to edit that day's 24-hour grid directly inline without creating a reusable template.

#### Manual mode
Override the schedule with a fixed temperature. Optionally set an end date/time — the thermostat automatically reverts to the schedule when the time is reached. Click **Back to schedule** to revert immediately.

---

## How the thermostat logic works

The integration runs an evaluation loop every minute:

1. Read the current temperature from the configured sensor.
2. Determine the target temperature:
   - **Manual mode**: use the manually set temperature (check expiry first).
   - **Schedule mode**: look up the current day and hour in the weekly schedule, resolve the day type, and map the slot value to comfort, eco, or 0 (off).
3. Control the boiler switch with hysteresis:
   - Turn **ON** when `current < target − 0.5 °C`
   - Turn **OFF** when `current ≥ target + 0.5 °C`
   - Turn **OFF** unconditionally when the slot value is Off (target = 0)

All configuration (schedule, day types, mode, manual temperature) is persisted to Home Assistant storage and survives restarts.

---

## File structure

```
custom_components/
└── ha_thermostat/
    ├── __init__.py          # Integration setup, coordinator, WebSocket API, panel registration
    ├── climate.py           # ClimateEntity (HVAC mode, preset mode, temperature)
    ├── config_flow.py       # Setup wizard (entity selectors for switch and sensor)
    ├── const.py             # Domain constants, default day types and schedule
    ├── manifest.json        # Integration metadata
    ├── services.yaml        # Custom service definitions
    ├── strings.json         # UI strings
    └── translations/
        ├── en.json          # English translations
        └── it.json          # Italian translations

www/
└── ha_thermostat/
    ├── ha-thermostat-card.js    # Lovelace custom card
    └── ha-thermostat-panel.js   # Full-page configuration panel
```

---

## WebSocket API

The integration exposes the following WebSocket commands (used internally by the frontend, but also callable from automations or scripts via `websocket_api`):

| Command | Description |
|---|---|
| `ha_thermostat/get_config` | Return the full configuration |
| `ha_thermostat/set_config` | Save comfort/eco temperatures, day types, or schedule |
| `ha_thermostat/set_manual` | Switch to manual mode (`temperature`, optional `end_datetime`) |
| `ha_thermostat/set_schedule_mode` | Switch back to schedule mode |
| `ha_thermostat/save_day_type` | Create or update a day type (`id`, `name`, `slots[24]`) |
| `ha_thermostat/delete_day_type` | Delete a custom day type by `id` |

---

## Troubleshooting

**The card shows "Loading…" indefinitely**
→ Make sure the integration has been set up (Settings → Integrations) and Home Assistant has been restarted after copying the files.

**The boiler switch is not responding**
→ Check that the switch entity exists and is reachable. Verify the entity ID in Settings → Integrations → HA Thermostat.

**Temperature sensor shows "unavailable"**
→ The thermostat will not control the boiler until the sensor returns a valid reading. Check the sensor entity in Developer Tools → States.

**Card type not found**
→ The browser may have cached the old resource list. Hard-refresh with Ctrl+Shift+R or clear the browser cache.

---

## Contributing

Pull requests and issues are welcome. Please open an issue before starting significant work so we can discuss the approach.

---

## License

MIT License — see [LICENSE](LICENSE) for details.
