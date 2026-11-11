"""Config flow for HA Thermostat."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.helpers import selector

from .const import (
    CONF_BOILER_ENTITY,
    CONF_COMFORT_TEMP,
    CONF_ECO_TEMP,
    CONF_SENSOR_ENTITY,
    DEFAULT_COMFORT_TEMP,
    DEFAULT_ECO_TEMP,
    DOMAIN,
)


class HAThermostatConfigFlow(ConfigFlow, domain=DOMAIN):
    """Handle the HA Thermostat configuration flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> ConfigFlowResult:
        """Single-step config flow."""
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")

        errors: dict[str, str] = {}

        if user_input is not None:
            comfort = user_input[CONF_COMFORT_TEMP]
            eco = user_input[CONF_ECO_TEMP]
            if eco >= comfort:
                errors["base"] = "invalid_temp"
            else:
                return self.async_create_entry(
                    title=user_input.get("name", "HA Thermostat"),
                    data={
                        CONF_BOILER_ENTITY: user_input[CONF_BOILER_ENTITY],
                        CONF_SENSOR_ENTITY: user_input[CONF_SENSOR_ENTITY],
                        CONF_COMFORT_TEMP: comfort,
                        CONF_ECO_TEMP: eco,
                    },
                )

        schema = vol.Schema(
            {
                vol.Optional("name", default="HA Thermostat"): str,
                vol.Required(CONF_BOILER_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="switch")
                ),
                vol.Required(CONF_SENSOR_ENTITY): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain="sensor",
                        device_class="temperature",
                    )
                ),
                vol.Optional(CONF_COMFORT_TEMP, default=DEFAULT_COMFORT_TEMP): vol.Coerce(float),
                vol.Optional(CONF_ECO_TEMP, default=DEFAULT_ECO_TEMP): vol.Coerce(float),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=schema,
            errors=errors,
        )
