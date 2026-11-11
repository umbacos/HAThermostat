DOMAIN = "ha_thermostat"
STORAGE_KEY = "ha_thermostat_data"
STORAGE_VERSION = 1

CONF_BOILER_ENTITY = "boiler_entity_id"
CONF_SENSOR_ENTITY = "sensor_entity_id"
CONF_COMFORT_TEMP = "comfort_temp"
CONF_ECO_TEMP = "eco_temp"

MODE_MANUAL = "manual"
MODE_SCHEDULE = "schedule"

# Slot values
SLOT_OFF = 0
SLOT_COMFORT = 1
SLOT_ECO = 2

# Hysteresis: turn on when below target - HYSTERESIS, off when above target + HYSTERESIS
HYSTERESIS = 0.5

DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

DEFAULT_DAY_TYPES = {
    "workday": {
        "name": "Giornata lavorativa / Workday",
        "slots": [0,0,0,0,0,0,1,1,2,2,2,2,2,2,2,2,2,2,1,1,1,1,0,0],
    },
    "vacation": {
        "name": "Tutti in vacanza / All on vacation",
        "slots": [2]*24,
    },
    "someone_home": {
        "name": "Qualcuno a casa / Someone home",
        "slots": [2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,2,2],
    },
}

DEFAULT_SCHEDULE = {day: {"type": "workday", "slots": None} for day in DAYS}
DEFAULT_SCHEDULE["sat"] = {"type": "someone_home", "slots": None}
DEFAULT_SCHEDULE["sun"] = {"type": "someone_home", "slots": None}

DEFAULT_COMFORT_TEMP = 21.0
DEFAULT_ECO_TEMP = 18.0
