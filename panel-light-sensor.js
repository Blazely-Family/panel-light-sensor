/**
 * Panel Light Sensor
 * Reports a wall panel's ambient light sensor (Fully Kiosk Browser) to Home Assistant.
 *
 * Runs on every Home Assistant page as a dashboard resource. On a tablet running Fully Kiosk with
 * the JavaScript Interface enabled, it reads the light sensor every 2 s and, when the value has
 * changed noticeably, sets input_number.<user>_lux_input over the page's existing connection.
 * <user> is the logged-in Home Assistant user's name as a slug ("Office Panel" -> office_panel).
 * Without Fully, or when that input_number does not exist, it does nothing.
 *
 * MIT License, (C) 2026 Blazely-Family
 */
(() => {
	const VERSION = "0.1.0";
	const POLL_INTERVAL_MS = 2000;
	const MIN_CHANGE_LUX = 1;
	const MIN_CHANGE_PERCENT = 10;
	const HEARTBEAT_MS = 60000;
	const TYPE_LIGHT = 5; // Android Sensor.TYPE_LIGHT

	const reporter = {
		lastEntity: null,
		lastValue: null,
		lastReportAt: 0,

		// Lux from fully.getSensorInfo() (a JSON string or an array); null without a light sensor.
		parseLux(sensorInfo) {
			let sensors = sensorInfo;
			if (typeof sensors === "string") {
				try {
					sensors = JSON.parse(sensors);
				} catch {
					return null;
				}
			}
			if (!Array.isArray(sensors)) return null;
			const light = sensors.find(
				(s) => s && s.type === TYPE_LIGHT && Array.isArray(s.values) && s.values.length > 0
			);
			if (!light) return null;
			const lux = Number(light.values[0]);
			return Number.isFinite(lux) ? lux : null;
		},

		// "Office Panel" -> "input_number.office_panel_lux_input"
		entityFor(userName) {
			if (!userName) return null;
			const slug = String(userName)
				.toLowerCase()
				.normalize("NFKD")
				.replace(/[̀-ͯ]/g, "")
				.replace(/[^a-z0-9]+/g, "_")
				.replace(/^_+|_+$/g, "");
			return slug ? `input_number.${slug}_lux_input` : null;
		},

		// True when a reading differs enough from the last report, or the heartbeat is due.
		shouldReport(lastValue, lastReportAt, value, now) {
			if (lastValue === null) return true;
			if (now - lastReportAt >= HEARTBEAT_MS) return true;
			const change = Math.abs(value - lastValue);
			const minChange = Math.max(MIN_CHANGE_LUX, (Math.abs(lastValue) * MIN_CHANGE_PERCENT) / 100);
			return change > 0 && change >= minChange;
		},

		clamp(value, min, max) {
			if (Number.isFinite(Number(min))) value = Math.max(Number(min), value);
			if (Number.isFinite(Number(max))) value = Math.min(Number(max), value);
			return value;
		},

		tick() {
			const fully = window.fully;
			if (!fully || typeof fully.getSensorInfo !== "function") return;
			const ha = document.querySelector("home-assistant");
			const hass = ha && ha.hass;
			if (!hass || !hass.user || !hass.states) return;
			const entity = this.entityFor(hass.user.name);
			const state = entity && hass.states[entity];
			if (!state) return;

			let lux = null;
			try {
				lux = this.parseLux(fully.getSensorInfo());
			} catch {
				return;
			}
			if (lux === null) return;
			const attrs = state.attributes || {};
			lux = this.clamp(Math.round(lux), attrs.min, attrs.max);

			if (entity !== this.lastEntity) {
				this.lastEntity = entity;
				this.lastValue = null;
			}
			const now = Date.now();
			if (!this.shouldReport(this.lastValue, this.lastReportAt, lux, now)) return;
			this.lastValue = lux;
			this.lastReportAt = now;
			if (Number(state.state) === lux) return;
			hass.callService("input_number", "set_value", { entity_id: entity, value: lux }).catch(() => {
				// Try again on the next tick
				this.lastValue = null;
			});
		}
	};

	if (typeof module !== "undefined" && module.exports) {
		module.exports = reporter; // for tests
		return;
	}
	if (window.__panelLightSensor) return; // loaded twice
	window.__panelLightSensor = reporter;
	if (!window.fully) return; // only Fully Kiosk has the sensor
	console.info(`%c PANEL-LIGHT-SENSOR %c v${VERSION} `, "color:#fff;background:#555", "");
	setInterval(() => reporter.tick(), POLL_INTERVAL_MS);
})();
