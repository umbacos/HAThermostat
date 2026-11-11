"""HA Thermostat integration."""
from __future__ import annotations

import copy
import logging
from datetime import datetime, timezone

import voluptuous as vol
from homeassistant.components import frontend, websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator
from homeassistant.util import dt as dt_util

from .const import (
    CONF_BOILER_ENTITY,
    CONF_COMFORT_TEMP,
    CONF_ECO_TEMP,
    CONF_SENSOR_ENTITY,
    DEFAULT_COMFORT_TEMP,
    DEFAULT_DAY_TYPES,
    DEFAULT_ECO_TEMP,
    DEFAULT_SCHEDULE,
    DOMAIN,
    HYSTERESIS,
    MODE_MANUAL,
    MODE_SCHEDULE,
    SLOT_COMFORT,
    SLOT_ECO,
    SLOT_OFF,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)
PLATFORMS = [Platform.CLIMATE]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up HA Thermostat from a config entry."""
    store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    stored = await store.async_load() or {}

    data = {
        CONF_BOILER_ENTITY: entry.data.get(CONF_BOILER_ENTITY),
        CONF_SENSOR_ENTITY: entry.data.get(CONF_SENSOR_ENTITY),
        CONF_COMFORT_TEMP: stored.get(CONF_COMFORT_TEMP, entry.data.get(CONF_COMFORT_TEMP, DEFAULT_COMFORT_TEMP)),
        CONF_ECO_TEMP: stored.get(CONF_ECO_TEMP, entry.data.get(CONF_ECO_TEMP, DEFAULT_ECO_TEMP)),
        "mode": stored.get("mode", MODE_SCHEDULE),
        "manual": stored.get("manual", {"temperature": None, "end_datetime": None}),
        "day_types": stored.get("day_types", copy.deepcopy(DEFAULT_DAY_TYPES)),
        "schedule": stored.get("schedule", copy.deepcopy(DEFAULT_SCHEDULE)),
    }

    coordinator = ThermostatCoordinator(hass, store, data)
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    _register_websocket_handlers(hass)
    _register_panel(hass)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unloaded = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unloaded:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unloaded


class ThermostatCoordinator(DataUpdateCoordinator):
    """Coordinator that evaluates schedule and controls the boiler."""

    def __init__(self, hass: HomeAssistant, store: Store, data: dict) -> None:
        super().__init__(hass, _LOGGER, name=DOMAIN)
        self._store = store
        self.data = data
        self._boiler_state: bool = False

    async def _async_update_data(self) -> dict:
        """Called every minute by HA. Evaluate schedule and control boiler."""
        self._check_manual_expiry()
        target = self._compute_target_temperature()
        current = self._get_current_temperature()

        if target is None or current is None:
            return self.data

        boiler_entity = self.data[CONF_BOILER_ENTITY]

        if target == 0:
            await self._set_boiler(boiler_entity, False)
        elif current < target - HYSTERESIS:
            await self._set_boiler(boiler_entity, True)
        elif current >= target + HYSTERESIS:
            await self._set_boiler(boiler_entity, False)

        return self.data

    def _check_manual_expiry(self) -> None:
        """If manual mode has expired, switch back to schedule."""
        if self.data["mode"] != MODE_MANUAL:
            return
        end = self.data["manual"].get("end_datetime")
        if end is None:
            return
        end_dt = datetime.fromisoformat(end) if isinstance(end, str) else end
        if end_dt.tzinfo is None:
            end_dt = end_dt.replace(tzinfo=timezone.utc)
        if dt_util.utcnow() >= end_dt:
            self.data["mode"] = MODE_SCHEDULE
            self.data["manual"] = {"temperature": None, "end_datetime": None}
            self.hass.async_create_task(self._save())

    def _compute_target_temperature(self) -> float | None:
        """Return the target temperature based on current mode."""
        if self.data["mode"] == MODE_MANUAL:
            return self.data["manual"].get("temperature")

        now = dt_util.as_local(dt_util.utcnow())
        day_map = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
        day_key = day_map[now.weekday()]
        hour = now.hour

        schedule_day = self.data["schedule"].get(day_key, {})
        day_type_id = schedule_day.get("type")
        custom_slots = schedule_day.get("slots")

        if day_type_id == "atypical" and custom_slots:
            slots = custom_slots
        elif day_type_id and day_type_id in self.data["day_types"]:
            slots = self.data["day_types"][day_type_id]["slots"]
        else:
            return None

        slot_value = slots[hour] if 0 <= hour < len(slots) else SLOT_OFF

        if slot_value == SLOT_COMFORT:
            return float(self.data[CONF_COMFORT_TEMP])
        if slot_value == SLOT_ECO:
            return float(self.data[CONF_ECO_TEMP])
        return 0.0

    def _get_current_temperature(self) -> float | None:
        """Read current temperature from the sensor entity."""
        sensor_id = self.data.get(CONF_SENSOR_ENTITY)
        if not sensor_id:
            return None
        state = self.hass.states.get(sensor_id)
        if state is None or state.state in ("unavailable", "unknown"):
            return None
        try:
            return float(state.state)
        except ValueError:
            return None

    async def _set_boiler(self, entity_id: str, on: bool) -> None:
        """Turn boiler switch on or off."""
        if self._boiler_state == on:
            return
        service = "turn_on" if on else "turn_off"
        await self.hass.services.async_call(
            "switch", service, {"entity_id": entity_id}, blocking=False
        )
        self._boiler_state = on

    async def _save(self) -> None:
        """Persist coordinator data to storage."""
        await self._store.async_save({
            CONF_COMFORT_TEMP: self.data[CONF_COMFORT_TEMP],
            CONF_ECO_TEMP: self.data[CONF_ECO_TEMP],
            "mode": self.data["mode"],
            "manual": self.data["manual"],
            "day_types": self.data["day_types"],
            "schedule": self.data["schedule"],
        })

    async def async_set_manual(self, temperature: float, end_datetime: str | None) -> None:
        """Switch to manual mode."""
        self.data["mode"] = MODE_MANUAL
        self.data["manual"] = {"temperature": temperature, "end_datetime": end_datetime}
        await self._save()
        await self.async_refresh()

    async def async_set_schedule_mode(self) -> None:
        """Switch to schedule mode."""
        self.data["mode"] = MODE_SCHEDULE
        self.data["manual"] = {"temperature": None, "end_datetime": None}
        await self._save()
        await self.async_refresh()

    async def async_save_full_config(self, config: dict) -> None:
        """Save full configuration from the panel."""
        for key in (CONF_COMFORT_TEMP, CONF_ECO_TEMP, "day_types", "schedule"):
            if key in config:
                self.data[key] = config[key]
        await self._save()
        await self.async_refresh()

    async def async_save_day_type(self, type_id: str, name: str, slots: list) -> None:
        """Create or update a day type."""
        self.data["day_types"][type_id] = {"name": name, "slots": slots}
        await self._save()

    async def async_delete_day_type(self, type_id: str) -> None:
        """Delete a custom day type and reset affected schedule days."""
        if type_id in DEFAULT_DAY_TYPES:
            raise ValueError("Cannot delete a built-in day type")
        self.data["day_types"].pop(type_id, None)
        for day_cfg in self.data["schedule"].values():
            if day_cfg.get("type") == type_id:
                day_cfg["type"] = "workday"
                day_cfg["slots"] = None
        await self._save()


def _get_coordinator(hass: HomeAssistant) -> ThermostatCoordinator | None:
    """Return the first available coordinator."""
    domain_data = hass.data.get(DOMAIN, {})
    if not domain_data:
        return None
    return next(iter(domain_data.values()))


def _register_websocket_handlers(hass: HomeAssistant) -> None:
    """Register websocket API handlers."""

    @websocket_api.websocket_command({vol.Required("type"): "ha_thermostat/get_config"})
    @callback
    def ws_get_config(hass: HomeAssistant, connection, msg) -> None:
        coord = _get_coordinator(hass)
        if coord is None:
            connection.send_error(msg["id"], "not_found", "Coordinator not found")
            return
        connection.send_result(msg["id"], {
            CONF_BOILER_ENTITY: coord.data[CONF_BOILER_ENTITY],
            CONF_SENSOR_ENTITY: coord.data[CONF_SENSOR_ENTITY],
            CONF_COMFORT_TEMP: coord.data[CONF_COMFORT_TEMP],
            CONF_ECO_TEMP: coord.data[CONF_ECO_TEMP],
            "mode": coord.data["mode"],
            "manual": coord.data["manual"],
            "day_types": coord.data["day_types"],
            "schedule": coord.data["schedule"],
        })

    @websocket_api.websocket_command({
        vol.Required("type"): "ha_thermostat/set_config",
        vol.Optional(CONF_COMFORT_TEMP): vol.Coerce(float),
        vol.Optional(CONF_ECO_TEMP): vol.Coerce(float),
        vol.Optional("day_types"): dict,
        vol.Optional("schedule"): dict,
    })
    @websocket_api.async_response
    async def ws_set_config(hass: HomeAssistant, connection, msg) -> None:
        coord = _get_coordinator(hass)
        if coord is None:
            connection.send_error(msg["id"], "not_found", "Coordinator not found")
            return
        payload = {k: v for k, v in msg.items() if k not in ("id", "type")}
        await coord.async_save_full_config(payload)
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.websocket_command({
        vol.Required("type"): "ha_thermostat/set_manual",
        vol.Required("temperature"): vol.Coerce(float),
        vol.Optional("end_datetime"): vol.Any(str, None),
    })
    @websocket_api.async_response
    async def ws_set_manual(hass: HomeAssistant, connection, msg) -> None:
        coord = _get_coordinator(hass)
        if coord is None:
            connection.send_error(msg["id"], "not_found", "Coordinator not found")
            return
        await coord.async_set_manual(msg["temperature"], msg.get("end_datetime"))
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.websocket_command({vol.Required("type"): "ha_thermostat/set_schedule_mode"})
    @websocket_api.async_response
    async def ws_set_schedule_mode(hass: HomeAssistant, connection, msg) -> None:
        coord = _get_coordinator(hass)
        if coord is None:
            connection.send_error(msg["id"], "not_found", "Coordinator not found")
            return
        await coord.async_set_schedule_mode()
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.websocket_command({
        vol.Required("type"): "ha_thermostat/save_day_type",
        vol.Required("id"): str,
        vol.Required("name"): str,
        vol.Required("slots"): [int],
    })
    @websocket_api.async_response
    async def ws_save_day_type(hass: HomeAssistant, connection, msg) -> None:
        coord = _get_coordinator(hass)
        if coord is None:
            connection.send_error(msg["id"], "not_found", "Coordinator not found")
            return
        if len(msg["slots"]) != 24:
            connection.send_error(msg["id"], "invalid_slots", "slots must have 24 values")
            return
        await coord.async_save_day_type(msg["id"], msg["name"], msg["slots"])
        connection.send_result(msg["id"], {"success": True})

    @websocket_api.websocket_command({
        vol.Required("type"): "ha_thermostat/delete_day_type",
        vol.Required("id"): str,
    })
    @websocket_api.async_response
    async def ws_delete_day_type(hass: HomeAssistant, connection, msg) -> None:
        coord = _get_coordinator(hass)
        if coord is None:
            connection.send_error(msg["id"], "not_found", "Coordinator not found")
            return
        try:
            await coord.async_delete_day_type(msg["id"])
        except ValueError as err:
            connection.send_error(msg["id"], "not_allowed", str(err))
            return
        connection.send_result(msg["id"], {"success": True})

    websocket_api.async_register_command(hass, ws_get_config)
    websocket_api.async_register_command(hass, ws_set_config)
    websocket_api.async_register_command(hass, ws_set_manual)
    websocket_api.async_register_command(hass, ws_set_schedule_mode)
    websocket_api.async_register_command(hass, ws_save_day_type)
    websocket_api.async_register_command(hass, ws_delete_day_type)


def _register_panel(hass: HomeAssistant) -> None:
    """Register the HA Thermostat custom panel."""
    frontend.async_register_built_in_panel(
        hass,
        "custom",
        "HA Thermostat",
        "mdi:thermostat",
        frontend_url_path="ha-thermostat",
        config={
            "_panel_custom": {
                "name": "ha-thermostat-panel",
                "module_url": "/local/ha_thermostat/ha-thermostat-panel.js",
            }
        },
        require_admin=False,
    )
