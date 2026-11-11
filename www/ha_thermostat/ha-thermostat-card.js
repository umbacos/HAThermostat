/**
 * HA Thermostat Card — Lovelace custom card
 * Displays current temperature, target, mode and quick controls.
 */
const CARD_VERSION = "1.0.0";

const SLOT_OFF = 0;
const SLOT_COMFORT = 1;
const SLOT_ECO = 2;

class HAThermostatCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._climateEntityId = null;
    this._thermoData = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("Please define an entity (climate.ha_thermostat)");
    this._config = config;
    this._climateEntityId = config.entity;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._fetchThermoData().then(() => this._render());
  }

  async _fetchThermoData() {
    if (!this._hass) return;
    try {
      this._thermoData = await this._hass.callWS({ type: "ha_thermostat/get_config" });
    } catch (e) {
      this._thermoData = null;
    }
  }

  getCardSize() { return 3; }

  _getClimateState() {
    if (!this._hass || !this._climateEntityId) return null;
    return this._hass.states[this._climateEntityId] || null;
  }

  _render() {
    const state = this._getClimateState();
    const data = this._thermoData;

    const currentTemp = state ? state.attributes.current_temperature : "--";
    const targetTemp = state ? state.attributes.temperature : "--";
    const hvacMode = state ? state.state : "off";
    const presetMode = state ? (state.attributes.preset_mode || "schedule") : "schedule";
    const mode = data ? data.mode : presetMode;
    const isManual = mode === "manual";
    const isOn = hvacMode === "heat";

    const manualTemp = data?.manual?.temperature ?? targetTemp;
    const manualEnd = data?.manual?.end_datetime ?? "";

    const lang = this._hass?.locale?.language || "en";
    const t = lang.startsWith("it") ? {
      title: "Termostato",
      current: "Attuale",
      target: "Target",
      boilerOn: "Caldaia: ON",
      boilerOff: "Caldaia: OFF",
      manual: "Manuale",
      schedule: "Programma",
      until: "fino a",
      setTemp: "Imposta temperatura",
      switchToSchedule: "Torna al programma",
      configure: "Configura"
    } : {
      title: "Thermostat",
      current: "Current",
      target: "Target",
      boilerOn: "Boiler: ON",
      boilerOff: "Boiler: OFF",
      manual: "Manual",
      schedule: "Schedule",
      until: "until",
      setTemp: "Set temperature",
      switchToSchedule: "Back to schedule",
      configure: "Configure"
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card {
          padding: 16px;
          font-family: var(--paper-font-body1_-_font-family);
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .title {
          font-size: 1.1em;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .boiler-badge {
          padding: 2px 10px;
          border-radius: 12px;
          font-size: 0.8em;
          font-weight: 600;
          background: ${isOn ? "#e8f5e9" : "#f5f5f5"};
          color: ${isOn ? "#2e7d32" : "#757575"};
          border: 1px solid ${isOn ? "#a5d6a7" : "#e0e0e0"};
        }
        .temps {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
          justify-content: center;
        }
        .temp-box {
          text-align: center;
          background: var(--secondary-background-color);
          border-radius: 12px;
          padding: 12px 20px;
          flex: 1;
        }
        .temp-label {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .temp-value {
          font-size: 2em;
          font-weight: 700;
          color: var(--primary-text-color);
        }
        .temp-value.target { color: #e64a19; }
        .mode-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }
        .mode-badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.85em;
          font-weight: 600;
          background: ${isManual ? "#fff3e0" : "#e3f2fd"};
          color: ${isManual ? "#e65100" : "#1565c0"};
        }
        .manual-end {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }
        .controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .temp-control {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--secondary-background-color);
          border-radius: 8px;
          padding: 8px 12px;
        }
        .temp-control label {
          flex: 1;
          font-size: 0.9em;
          color: var(--primary-text-color);
        }
        .temp-control input[type=number] {
          width: 70px;
          padding: 4px 8px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          font-size: 0.95em;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .datetime-control {
          background: var(--secondary-background-color);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.9em;
        }
        .datetime-control label { color: var(--secondary-text-color); display: block; margin-bottom: 4px; }
        .datetime-control input[type=datetime-local] {
          width: 100%;
          box-sizing: border-box;
          padding: 4px 8px;
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .btn-row { display: flex; gap: 8px; margin-top: 4px; }
        button {
          flex: 1;
          padding: 8px 12px;
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
        .btn-schedule { background: #1565c0; color: white; }
        .btn-panel { background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color); font-size: 0.8em; padding: 6px 10px; }
      </style>
      <ha-card>
        <div class="header">
          <span class="title">🌡 ${t.title}</span>
          <span class="boiler-badge">${isOn ? t.boilerOn : t.boilerOff}</span>
        </div>
        <div class="temps">
          <div class="temp-box">
            <div class="temp-label">${t.current}</div>
            <div class="temp-value">${currentTemp !== undefined && currentTemp !== null ? currentTemp + "°" : "--"}</div>
          </div>
          <div class="temp-box">
            <div class="temp-label">${t.target}</div>
            <div class="temp-value target">${targetTemp !== undefined && targetTemp !== null ? targetTemp + "°" : "--"}</div>
          </div>
        </div>
        <div class="mode-row">
          <span class="mode-badge">${isManual ? t.manual : t.schedule}</span>
          ${isManual && manualEnd ? `<span class="manual-end">${t.until} ${new Date(manualEnd).toLocaleString()}</span>` : ""}
        </div>
        <div class="controls">
          <div class="temp-control">
            <label>${t.setTemp}</label>
            <button class="btn-secondary" id="btn-minus">−</button>
            <input type="number" id="manual-temp" value="${parseFloat(manualTemp) || 21}" min="5" max="30" step="0.5" />
            <button class="btn-secondary" id="btn-plus">+</button>
          </div>
          <div class="datetime-control" style="display:${isManual ? "block" : "none"}" id="manual-end-section">
            <label>${t.until}</label>
            <input type="datetime-local" id="manual-end-dt" value="${manualEnd ? manualEnd.slice(0,16) : ""}" />
          </div>
          <div class="btn-row">
            <button class="btn-primary" id="btn-set-manual">${t.setTemp}</button>
            <button class="btn-schedule" id="btn-set-schedule">${t.switchToSchedule}</button>
          </div>
          <div class="btn-row">
            <button class="btn-panel" id="btn-panel">${t.configure}</button>
          </div>
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById("btn-minus").addEventListener("click", () => {
      const inp = this.shadowRoot.getElementById("manual-temp");
      inp.value = Math.max(5, parseFloat(inp.value) - 0.5).toFixed(1);
    });
    this.shadowRoot.getElementById("btn-plus").addEventListener("click", () => {
      const inp = this.shadowRoot.getElementById("manual-temp");
      inp.value = Math.min(30, parseFloat(inp.value) + 0.5).toFixed(1);
    });
    this.shadowRoot.getElementById("btn-set-manual").addEventListener("click", () => {
      const temp = parseFloat(this.shadowRoot.getElementById("manual-temp").value);
      const endVal = this.shadowRoot.getElementById("manual-end-dt").value;
      const endDt = endVal ? new Date(endVal).toISOString() : null;
      this._hass.callWS({ type: "ha_thermostat/set_manual", temperature: temp, end_datetime: endDt })
        .then(() => { this._fetchThermoData().then(() => this._render()); });
    });
    this.shadowRoot.getElementById("btn-set-schedule").addEventListener("click", () => {
      this._hass.callWS({ type: "ha_thermostat/set_schedule_mode" })
        .then(() => { this._fetchThermoData().then(() => this._render()); });
    });
    this.shadowRoot.getElementById("btn-panel").addEventListener("click", () => {
      history.pushState(null, "", "/ha-thermostat");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  }
}

customElements.define("ha-thermostat-card", HAThermostatCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-thermostat-card",
  name: "HA Thermostat",
  description: "Smart thermostat with manual and weekly schedule modes",
  preview: false,
  documentationURL: "",
});

console.info(`%c COPRE-THERMOSTAT-CARD %c v${CARD_VERSION} `, "color:white;background:#e64a19;font-weight:bold", "color:#e64a19;background:white;font-weight:bold");
