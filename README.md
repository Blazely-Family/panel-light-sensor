# Panel Light Sensor

Reports a wall panel's ambient light (lux) to Home Assistant within a couple of
seconds of it changing, so automations can react when a room goes dark or light.

It's for Android tablets running **Fully Kiosk Browser** with *Enable JavaScript
Interface* turned on. Fully's own report (MQTT or REST) only updates about once a
minute.

## How it works

The file loads as a dashboard resource on every Home Assistant page. On a tablet
running Fully, it reads the light sensor locally every 2 s (`fully.getSensorInfo()`).
When the value has changed by at least 1 lux **and** 10 %, or 60 s have passed, it
calls `input_number.set_value` over the page's existing Home Assistant connection.

There is no configuration. The entity comes from the logged-in Home Assistant
user's name:

| HA user | Entity it writes |
|---|---|
| Office Panel | `input_number.office_panel_lux_input` |
| Kitchen Panel | `input_number.kitchen_panel_lux_input` |

If that `input_number` doesn't exist, or the page isn't running in Fully, it does nothing.
That makes it safe on phones and PCs.

## Setup

1. Marketplace / HACS → custom repositories → add this repository as a **Dashboard**
   repository and download it. The resource is registered for you.
2. For each panel, create an `input_number` helper named "<user name> Lux Input"
   (for example min 0, max 5000, step 1, unit `lx`). Hide it if you like.
3. Reload the panel.

`input_number` is used because Home Assistant sensors can't be set by a service call.
If you need a real `sensor` (for a threshold helper, for example), wrap the input in a
template sensor: `{{ states('input_number.office_panel_lux_input') | float(none) }}`.
