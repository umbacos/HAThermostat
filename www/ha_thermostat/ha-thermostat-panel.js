/**
 * HA Thermostat Panel — Full-page configuration panel
 * Sections: General settings | Day Types | Weekly Schedule | Manual Mode
 */
const PANEL_VERSION = "1.0.0";

const SLOT_OFF = 0;
const SLOT_COMFORT = 1;
const SLOT_ECO = 2;

const SLOT_COLORS = {
  [SLOT_OFF]:     { bg: "#f5f5f5", fg: "#9e9e9e", label: "Off" },
  [SLOT_COMFORT]: { bg: "#fff3e0", fg: "#e64a19", label: "C" },
  [SLOT_ECO]:     { bg: "#e3f2fd", fg: "#1565c0", label: "E" },
};

const DAYS_EN = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAYS_IT = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];

class HAThermostatPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = null;
    this._activeSection = "schedule";
    this._editingDayType = null;
    this._editingDayTypeSlots = new Array(24).fill(SLOT_OFF);
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) {
      this._loadConfig();
    }
  }

  set panel(panel) { /* unused */ }
  set narrow(v) { /* unused */ }

  async _loadConfig() {
    try {
      this._config = await this._hass.callWS({ type: "ha_thermostat/get_config" });
    } catch (e) {
      this._config = null;
    }
    this._render();
  }

  _t(key) {
    const lang = this._hass?.locale?.language || "en";
    const isIt = lang.startsWith("it");
    const tr = {
      title:          isIt ? "HA Termostato"       : "HA Thermostat",
      general:        isIt ? "Impostazioni generali"  : "General settings",
      dayTypes:       isIt ? "Giornate tipo"          : "Day types",
      schedule:       isIt ? "Programma settimanale"  : "Weekly schedule",
      manual:         isIt ? "Modalità manuale"       : "Manual mode",
      boiler:         isIt ? "Switch caldaia"         : "Boiler switch",
      sensor:         isIt ? "Sensore temperatura"    : "Temperature sensor",
      comfortTemp:    isIt ? "Temperatura comfort"    : "Comfort temperature",
      ecoTemp:        isIt ? "Temperatura eco"        : "Eco temperature",
      save:           isIt ? "Salva"                  : "Save",
      saved:          isIt ? "Salvato!"               : "Saved!",
      addDayType:     isIt ? "Aggiungi giornata tipo" : "Add day type",
      editDayType:    isIt ? "Modifica"               : "Edit",
      deleteDayType:  isIt ? "Elimina"                : "Delete",
      dayTypeName:    isIt ? "Nome giornata tipo"     : "Day type name",
      confirmDelete:  isIt ? "Conferma eliminazione?" : "Confirm delete?",
      atypical:       isIt ? "Atipica"                : "Atypical",
      setManual:      isIt ? "Imposta manuale"        : "Set manual",
      backToSchedule: isIt ? "Torna al programma"     : "Back to schedule",
      until:          isIt ? "Fino a (opzionale)"     : "Until (optional)",
      currentMode:    isIt ? "Modalità attuale"       : "Current mode",
      days:           isIt ? DAYS_IT : DAYS_EN,
      off: "Off", comfort: "Comfort", eco: "Eco",
      cancelEdit:     isIt ? "Annulla"                : "Cancel",
    };
    return tr[key] ?? key;
  }

  _render() {
    if (!this._hass) return;
    const cfg = this._config;

    const sections = ["general", "dayTypes", "schedule", "manual"];
    const tabLabels = sections.map(s => this._t(s));

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; background: var(--primary-background-color); overflow-y: auto; }
        .panel-header {
          background: var(--app-header-background-color, #e64a19);
          color: var(--app-header-text-color, white);
          padding: 16px 24px;
          font-size: 1.2em;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .tabs {
          display: flex;
          background: var(--card-background-color);
          border-bottom: 1px solid var(--divider-color);
          padding: 0 16px;
          overflow-x: auto;
          position: sticky;
          top: 56px;
          z-index: 9;
        }
        .tab {
          padding: 12px 20px;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          font-size: 0.95em;
          font-weight: 500;
          white-space: nowrap;
          color: var(--secondary-text-color);
          transition: all 0.2s;
        }
        .tab.active {
          border-bottom-color: #e64a19;
          color: #e64a19;
        }
        .content {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .card {
          background: var(--card-background-color);
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 16px;
          box-shadow: var(--shadow-elevation-2dp_-_box-shadow, 0 2px 4px rgba(0,0,0,0.1));
        }
        .card h3 { margin: 0 0 16px 0; font-size: 1em; color: var(--primary-text-color); }
        .field-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }
        .field-row label { flex: 1; font-size: 0.9em; color: var(--secondary-text-color); }
        .field-row input[type=text], .field-row input[type=number] {
          width: 120px;
          padding: 6px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font-size: 0.95em;
        }
        button {
          padding: 8px 16px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9em;
          font-weight: 500;
          transition: opacity 0.2s;
        }
        button:hover { opacity: 0.85; }
        .btn-primary { background: #e64a19; color: white; }
        .btn-secondary { background: var(--secondary-background-color); color: var(--primary-text-color); border: 1px solid var(--divider-color); }
        .btn-danger { background: #c62828; color: white; }
        .btn-success { background: #2e7d32; color: white; }
        .btn-sm { padding: 4px 10px; font-size: 0.8em; }

        /* Day types list */
        .day-type-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 0;
          border-bottom: 1px solid var(--divider-color);
        }
        .day-type-item:last-child { border-bottom: none; }
        .day-type-name { flex: 1; font-size: 0.95em; color: var(--primary-text-color); }
        .slot-preview {
          display: flex;
          gap: 1px;
          height: 16px;
          border-radius: 4px;
          overflow: hidden;
        }
        .slot-preview-cell {
          flex: 1;
          min-width: 4px;
        }

        /* Day type editor */
        .day-type-editor {
          margin-top: 16px;
          background: var(--secondary-background-color);
          border-radius: 10px;
          padding: 16px;
        }
        .editor-header { margin-bottom: 12px; }
        .editor-header input[type=text] {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          font-size: 1em;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          margin-bottom: 10px;
        }
        .slots-grid {
          display: grid;
          grid-template-columns: repeat(24, 1fr);
          gap: 3px;
          margin: 10px 0;
        }
        .slot-cell {
          height: 36px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7em;
          font-weight: 700;
          user-select: none;
          transition: opacity 0.15s, transform 0.1s;
        }
        .slot-cell:hover { opacity: 0.8; transform: scale(1.05); }
        .slots-hours {
          display: grid;
          grid-template-columns: repeat(24, 1fr);
          gap: 3px;
          margin-bottom: 4px;
        }
        .hour-label {
          text-align: center;
          font-size: 0.65em;
          color: var(--secondary-text-color);
        }
        .legend {
          display: flex;
          gap: 12px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }
        .legend-swatch {
          width: 20px;
          height: 14px;
          border-radius: 3px;
        }

        /* Weekly schedule */
        .week-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--divider-color);
          flex-wrap: wrap;
        }
        .week-row:last-child { border-bottom: none; }
        .day-label {
          width: 36px;
          font-weight: 600;
          font-size: 0.9em;
          color: var(--primary-text-color);
          padding-top: 6px;
        }
        .week-controls { flex: 1; min-width: 200px; }
        select {
          padding: 6px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font-size: 0.9em;
          cursor: pointer;
          width: 100%;
          max-width: 260px;
          margin-bottom: 8px;
        }
        .atypical-grid { margin-top: 8px; }

        /* Manual mode */
        .manual-status {
          padding: 12px 16px;
          border-radius: 10px;
          background: var(--secondary-background-color);
          margin-bottom: 16px;
          font-size: 0.9em;
        }
        .manual-status strong { color: #e64a19; }
        .datetime-field {
          margin-bottom: 12px;
        }
        .datetime-field label { display: block; font-size: 0.85em; color: var(--secondary-text-color); margin-bottom: 4px; }
        .datetime-field input {
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          font-size: 0.95em;
          width: 100%;
          box-sizing: border-box;
        }

        .toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: #2e7d32;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 500;
          z-index: 100;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .toast.show { opacity: 1; }

        @media (max-width: 600px) {
          .content { padding: 12px; }
          .slots-grid, .slots-hours { grid-template-columns: repeat(12, 1fr); }
        }
      </style>

      <div class="panel-header">
        <ha-icon icon="mdi:thermostat"></ha-icon>
        ${this._t("title")}
      </div>

      <div class="tabs">
        ${sections.map((s, i) => `
          <div class="tab ${this._activeSection === s ? "active" : ""}" data-section="${s}">
            ${tabLabels[i]}
          </div>
        `).join("")}
      </div>

      <div class="content" id="main-content">
        ${cfg ? this._renderSection() : `<div class="card"><p>Loading...</p></div>`}
      </div>

      <div class="toast" id="toast">${this._t("saved")}</div>
    `;

    this.shadowRoot.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        this._activeSection = tab.dataset.section;
        this._render();
      });
    });

    this._attachSectionListeners();
  }

  _renderSection() {
    switch (this._activeSection) {
      case "general":   return this._renderGeneral();
      case "dayTypes":  return this._renderDayTypes();
      case "schedule":  return this._renderSchedule();
      case "manual":    return this._renderManual();
      default:          return "";
    }
  }

  // ── GENERAL SETTINGS ─────────────────────────────────────────────────────
  _renderGeneral() {
    const cfg = this._config;
    return `
      <div class="card">
        <h3>${this._t("general")}</h3>
        <div class="field-row">
          <label>${this._t("boiler")}</label>
          <span style="font-size:0.9em;color:var(--primary-text-color)">${cfg.boiler_entity_id || "-"}</span>
        </div>
        <div class="field-row">
          <label>${this._t("sensor")}</label>
          <span style="font-size:0.9em;color:var(--primary-text-color)">${cfg.sensor_entity_id || "-"}</span>
        </div>
        <div class="field-row">
          <label>${this._t("comfortTemp")} (°C)</label>
          <input type="number" id="comfort-temp" value="${cfg.comfort_temp}" min="5" max="30" step="0.5" />
        </div>
        <div class="field-row">
          <label>${this._t("ecoTemp")} (°C)</label>
          <input type="number" id="eco-temp" value="${cfg.eco_temp}" min="5" max="30" step="0.5" />
        </div>
        <button class="btn-primary" id="btn-save-general">${this._t("save")}</button>
      </div>
    `;
  }

  // ── DAY TYPES ──────────────────────────────────────────────────────────────
  _renderDayTypes() {
    const dayTypes = this._config.day_types || {};
    const editing = this._editingDayType;

    const list = Object.entries(dayTypes).map(([id, dt]) => `
      <div class="day-type-item">
        <span class="day-type-name">${dt.name}</span>
        <div class="slot-preview">
          ${dt.slots.map(s => `<div class="slot-preview-cell" style="background:${SLOT_COLORS[s].bg}"></div>`).join("")}
        </div>
        <button class="btn-secondary btn-sm" data-edit-dt="${id}">${this._t("editDayType")}</button>
        ${!["workday","vacation","someone_home"].includes(id)
          ? `<button class="btn-danger btn-sm" data-delete-dt="${id}">${this._t("deleteDayType")}</button>`
          : ""}
      </div>
    `).join("");

    const editorHtml = editing !== null ? `
      <div class="day-type-editor" id="dt-editor">
        <div class="editor-header">
          <input type="text" id="dt-name" value="${dayTypes[editing]?.name || ""}" placeholder="${this._t("dayTypeName")}" />
        </div>
        ${this._renderSlotsEditor("dt-slots-grid", this._editingDayTypeSlots)}
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn-success" id="btn-save-dt">${this._t("save")}</button>
          <button class="btn-secondary" id="btn-cancel-dt">${this._t("cancelEdit")}</button>
        </div>
      </div>
    ` : `<button class="btn-primary" id="btn-add-dt" style="margin-top:12px">${this._t("addDayType")}</button>`;

    return `
      <div class="card">
        <h3>${this._t("dayTypes")}</h3>
        ${list}
        ${editorHtml}
        ${this._renderLegend()}
      </div>
    `;
  }

  // ── SCHEDULE ───────────────────────────────────────────────────────────────
  _renderSchedule() {
    const { day_types, schedule } = this._config;
    const dayTypeOptions = [
      ...Object.entries(day_types).map(([id, dt]) => `<option value="${id}">${dt.name}</option>`),
      `<option value="atypical">${this._t("atypical")}</option>`,
    ].join("");

    const rows = DAY_KEYS.map((key, i) => {
      const daySchedule = schedule[key] || { type: "workday", slots: null };
      const isAtypical = daySchedule.type === "atypical";
      const daySlots = isAtypical && daySchedule.slots ? daySchedule.slots : new Array(24).fill(SLOT_COMFORT);

      return `
        <div class="week-row" data-day="${key}">
          <span class="day-label">${this._t("days")[i]}</span>
          <div class="week-controls">
            <select id="sel-${key}">
              ${dayTypeOptions.replace(`value="${daySchedule.type}"`, `value="${daySchedule.type}" selected`)}
            </select>
            ${isAtypical ? `
              <div class="atypical-grid">
                ${this._renderSlotsEditor("day-slots-" + key, daySlots, key)}
              </div>
            ` : `
              <div class="slot-preview" style="height:24px;border-radius:6px;overflow:hidden">
                ${(day_types[daySchedule.type]?.slots || []).map(s => `<div style="flex:1;background:${SLOT_COLORS[s]?.bg || "#eee'}"></div>`).join("")}
              </div>
            `}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="card">
        <h3>${this._t("schedule")}</h3>
        ${rows}
        ${this._renderLegend()}
        <div style="margin-top:16px">
          <button class="btn-primary" id="btn-save-schedule">${this._t("save")}</button>
        </div>
      </div>
    `;
  }

  // ── MANUAL MODE ────────────────────────────────────────────────────────────
  _renderManual() {
    const { mode, manual, comfort_temp } = this._config;
    const isManual = mode === "manual";
    const manualTemp = manual?.temperature ?? comfort_temp ?? 21;
    const manualEnd = manual?.end_datetime ?? "";

    return `
      <div class="card">
        <h3>${this._t("manual")}</h3>
        <div class="manual-status">
          ${this._t("currentMode")}: <strong>${isManual ? this._t("manual") : this._t("schedule")}</strong>
          ${isManual && manualEnd ? `<br>${this._t("until")}: ${new Date(manualEnd).toLocaleString()}` : ""}
        </div>
        <div class="field-row">
          <label>°C</label>
          <button class="btn-secondary" id="btn-minus-m">−</button>
          <input type="number" id="manual-temp" value="${parseFloat(manualTemp) || 21}" min="5" max="30" step="0.5" style="width:80px" />
          <button class="btn-secondary" id="btn-plus-m">+</button>
        </div>
        <div class="datetime-field">
          <label>${this._t("until")}</label>
          <input type="datetime-local" id="manual-end-dt" value="${manualEnd ? manualEnd.slice(0,16) : ""}" />
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-primary" id="btn-set-manual">${this._t("setManual")}</button>
          <button class="btn-secondary" id="btn-set-schedule">${this._t("backToSchedule")}</button>
        </div>
      </div>
    `;
  }

  // ── SLOTS EDITOR HELPER ────────────────────────────────────────────────────
  _renderSlotsEditor(gridId, slots, dayKey) {
    const hours = Array.from({length: 24}, (_, i) => i);
    return `
      <div class="slots-hours">
        ${hours.map(h => `<div class="hour-label">${h}</div>`).join("")}
      </div>
      <div class="slots-grid" id="${gridId}" ${dayKey ? `data-day-key="${dayKey}"` : ""}>
        ${slots.map((s, h) => `
          <div class="slot-cell"
               data-hour="${h}"
               data-slot="${s}"
               data-grid="${gridId}"
               style="background:${SLOT_COLORS[s].bg};color:${SLOT_COLORS[s].fg}">
            ${SLOT_COLORS[s].label}
          </div>
        `).join("")}
      </div>
    `;
  }

  _renderLegend() {
    return `
      <div class="legend">
        ${Object.entries(SLOT_COLORS).map(([val, c]) => `
          <div class="legend-item">
            <div class="legend-swatch" style="background:${c.bg};border:1px solid ${c.fg}"></div>
            ${val == SLOT_OFF ? this._t("off") : val == SLOT_COMFORT ? this._t("comfort") : this._t("eco")}
          </div>
        `).join("")}
      </div>
    `;
  }

  // ── EVENT LISTENERS ────────────────────────────────────────────────────────
  _attachSectionListeners() {
    const root = this.shadowRoot;

    // Slot cell click (cycle: off → comfort → eco → off)
    root.addEventListener("click", (e) => {
      const cell = e.target.closest(".slot-cell");
      if (!cell) return;
      const gridId = cell.dataset.grid;
      const hour = parseInt(cell.dataset.hour);
      const current = parseInt(cell.dataset.slot);
      const next = (current + 1) % 3;

      // Find array to update
      const dayKey = root.getElementById(gridId)?.dataset.dayKey;
      if (dayKey) {
        // Day schedule atypical slot
        const daySchedule = this._config.schedule[dayKey];
        if (!daySchedule.slots) daySchedule.slots = new Array(24).fill(SLOT_COMFORT);
        daySchedule.slots[hour] = next;
      } else if (gridId === "dt-slots-grid") {
        // Day type editor slot
        this._editingDayTypeSlots[hour] = next;
      }

      cell.dataset.slot = next;
      cell.style.background = SLOT_COLORS[next].bg;
      cell.style.color = SLOT_COLORS[next].fg;
      cell.textContent = SLOT_COLORS[next].label;
    });

    // General settings save
    const btnSaveGeneral = root.getElementById("btn-save-general");
    if (btnSaveGeneral) {
      btnSaveGeneral.addEventListener("click", async () => {
        const comfort = parseFloat(root.getElementById("comfort-temp").value);
        const eco = parseFloat(root.getElementById("eco-temp").value);
        if (eco >= comfort) { alert("Eco < Comfort required"); return; }
        await this._hass.callWS({ type: "ha_thermostat/set_config", comfort_temp: comfort, eco_temp: eco });
        this._config.comfort_temp = comfort;
        this._config.eco_temp = eco;
        this._showToast();
      });
    }

    // Day type add
    const btnAddDt = root.getElementById("btn-add-dt");
    if (btnAddDt) {
      btnAddDt.addEventListener("click", () => {
        this._editingDayType = "__new__";
        this._editingDayTypeSlots = new Array(24).fill(SLOT_OFF);
        this._render();
      });
    }

    // Day type edit
    root.querySelectorAll("[data-edit-dt]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.editDt;
        this._editingDayType = id;
        this._editingDayTypeSlots = [...(this._config.day_types[id]?.slots || new Array(24).fill(SLOT_OFF))];
        this._render();
      });
    });

    // Day type delete
    root.querySelectorAll("[data-delete-dt]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteDt;
        if (!confirm(this._t("confirmDelete"))) return;
        await this._hass.callWS({ type: "ha_thermostat/delete_day_type", id });
        delete this._config.day_types[id];
        this._render();
      });
    });

    // Day type save (editor)
    const btnSaveDt = root.getElementById("btn-save-dt");
    if (btnSaveDt) {
      btnSaveDt.addEventListener("click", async () => {
        const nameEl = root.getElementById("dt-name");
        const name = nameEl.value.trim();
        if (!name) { nameEl.focus(); return; }
        const id = this._editingDayType === "__new__"
          ? "custom_" + Date.now()
          : this._editingDayType;
        await this._hass.callWS({ type: "ha_thermostat/save_day_type", id, name, slots: this._editingDayTypeSlots });
        this._config.day_types[id] = { name, slots: [...this._editingDayTypeSlots] };
        this._editingDayType = null;
        this._showToast();
        this._render();
      });
    }

    // Day type cancel edit
    const btnCancelDt = root.getElementById("btn-cancel-dt");
    if (btnCancelDt) {
      btnCancelDt.addEventListener("click", () => {
        this._editingDayType = null;
        this._render();
      });
    }

    // Schedule: change day type select
    DAY_KEYS.forEach(key => {
      const sel = root.getElementById("sel-" + key);
      if (sel) {
        sel.addEventListener("change", () => {
          const type = sel.value;
          this._config.schedule[key] = {
            type,
            slots: type === "atypical" ? new Array(24).fill(SLOT_COMFORT) : null,
          };
          this._render();
        });
      }
    });

    // Schedule save
    const btnSaveSchedule = root.getElementById("btn-save-schedule");
    if (btnSaveSchedule) {
      btnSaveSchedule.addEventListener("click", async () => {
        await this._hass.callWS({ type: "ha_thermostat/set_config", schedule: this._config.schedule });
        this._showToast();
      });
    }

    // Manual mode
    const btnMinus = root.getElementById("btn-minus-m");
    const btnPlus  = root.getElementById("btn-plus-m");
    if (btnMinus) {
      btnMinus.addEventListener("click", () => {
        const inp = root.getElementById("manual-temp");
        inp.value = Math.max(5, parseFloat(inp.value) - 0.5).toFixed(1);
      });
    }
    if (btnPlus) {
      btnPlus.addEventListener("click", () => {
        const inp = root.getElementById("manual-temp");
        inp.value = Math.min(30, parseFloat(inp.value) + 0.5).toFixed(1);
      });
    }
    const btnSetManual = root.getElementById("btn-set-manual");
    if (btnSetManual) {
      btnSetManual.addEventListener("click", async () => {
        const temp = parseFloat(root.getElementById("manual-temp").value);
        const endVal = root.getElementById("manual-end-dt").value;
        const endDt = endVal ? new Date(endVal).toISOString() : null;
        await this._hass.callWS({ type: "ha_thermostat/set_manual", temperature: temp, end_datetime: endDt });
        this._config.mode = "manual";
        this._config.manual = { temperature: temp, end_datetime: endDt };
        this._showToast();
        this._render();
      });
    }
    const btnSetSchedule = root.getElementById("btn-set-schedule");
    if (btnSetSchedule) {
      btnSetSchedule.addEventListener("click", async () => {
        await this._hass.callWS({ type: "ha_thermostat/set_schedule_mode" });
        this._config.mode = "schedule";
        this._config.manual = { temperature: null, end_datetime: null };
        this._showToast();
        this._render();
      });
    }
  }

  _showToast() {
    const toast = this.shadowRoot.getElementById("toast");
    if (!toast) return;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
  }
}

customElements.define("ha-thermostat-panel", HAThermostatPanel);
console.info(`%c COPRE-THERMOSTAT-PANEL %c v${PANEL_VERSION} `, "color:white;background:#1565c0;font-weight:bold", "color:#1565c0;background:white;font-weight:bold");
