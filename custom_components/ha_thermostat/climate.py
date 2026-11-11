"""HA Thermostat climate entity."""
from __future__ import annotations

from homeassistant.components.climate import ClimateEntity, ClimateEntityFeature
from homeassistant.components.climate.const import HVACMode
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import ThermostatCoordinator
from .const import (
    CONF_COMFORT_TEMP,
    CONF_SENSOR_ENTITY,
    DOMAIN,
    MODE_MANUAL,
    MODE_SCHEDULE,
)

PRESET_MANUAL = "manual"
PRESET_SCHEDULE = "schedule"


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the climate entity."""
    coordinator: ThermostatCoordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([HAThermostatEntity(coordinator, entry)])


class HAThermostatEntity(CoordinatorEntity, ClimateEntity):
    """Climate entity for HA Thermostat."""

    _attr_hvac_modes = [HVACMode.OFF, HVACMode.HEAT]
    _attr_preset_modes = [PRESET_MANUAL, PRESET_SCHEDULE]
    _attr_supported_features = (
        ClimateEntityFeature.TARGET_TEMPERATURE | ClimateEntityFeature.PRESET_MODE
    )
    _attr_temperature_unit = UnitOfTemperature.CELSIUS
    _attr_min_temp = 5.0
    _attr_max_temp = 30.0
    _attr_target_temperature_step = 0.5
    _attr_has_entity_name = True
    _attr_name = None

    def __init__(self, coordinator: ThermostatCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = entry.entry_id
        self._attr_device_info = {
            "identifiers": {(DOMAIN, entry.entry_id)},
            "name": entry.title,
            "manufacturer": "HA Thermostat",
            "model": "Smart Thermostat",
        }

    @property
    def hvac_mode(self) -> HVACMode:
        """Return OFF or HEAT based on the computed target."""
        target = self.coordinator._compute_target_temperature()
        if target is None or target == 0:
            return HVACMode.OFF
        return HVACMode.HEAT

    @property
    def preset_mode(self) -> str:
        """Return current preset (manual or schedule)."""
        mode = self.coordinator.data.get("mode", MODE_SCHEDULE)
        return PRESET_MANUAL if mode == MODE_MANUAL else PRESET_SCHEDULE

    @property
    def current_temperature(self) -> float | None:
        """Return current temperature from sensor."""
        return self.coordinator._get_current_temperature()

    @property
    def target_temperature(self) -> float | None:
        """Return target temperature."""
        target = self.coordinator._compute_target_temperature()
        if target == 0:
            return float(self.coordinator.data[CONF_COMFORT_TEMP])
        return target

    async def async_set_hvac_mode(self, hvac_mode: HVACMode) -> None:
        """Handle HVAC mode change: OFF turns off boiler via schedule slot 0."""
        if hvac_mode == HVACMode.OFF:
            await self.coordinator.async_set_manual(0.0, None)
        else:
            await self.coordinator.async_set_schedule_mode()

    async def async_set_temperature(self, **kwargs) -> None:
        """Set new target temperature (switches to manual mode)."""
        temp = kwargs.get("temperature")
        if temp is not None:
            await self.coordinator.async_set_manual(float(temp), None)

    async def async_set_preset_mode(self, preset_mode: str) -> None:
        """Switch between manual and schedule presets."""
        if preset_mode == PRESET_SCHEDULE:
            await self.coordinator.async_set_schedule_mode()
        elif preset_mode == PRESET_MANUAL:
            current_target = self.target_temperature or float(
                self.coordinator.data[CONF_COMFORT_TEMP]
            )
            await self.coordinator.async_set_manual(current_target, None)
