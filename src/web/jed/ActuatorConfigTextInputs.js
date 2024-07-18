import { byId } from "./domQuery.js";
import { clamp } from "./utils.js";

class ActuatorConfigTextInputs {
    constructor(elementId, initialConfig) {
        // Get elements
        this.rootElement = byId(elementId);

        this.fields = [];
        for (const inputElement of this.rootElement.getElementsByClassName("actuator-input")) {
            this.fields.push({
                name: inputElement.id,
                inputElement: inputElement,
            });

            // If field loses focus, clamp the value to the acceptable range
            inputElement.addEventListener("blur", (event) => {
                const value = Number(event.target.value);
                const min = Number(event.target.min);
                const max = Number(event.target.max);
                event.target.value = clamp(value, min, max);
            });
        }

        this.setConfig(initialConfig);
    }

    setConfig(config) {
        if (config == null) {
            console.warn(
                "ActuatorConfigTextinputs: Ignored a <null> config.  If you are in simulator, you can safely ignore this message, as jaiabot_arduino is not running.",
            );
            return;
        }
        this._config = config;
        this.update();
    }

    update() {
        for (const field of this.fields) {
            field.inputElement.value = this._config[field.name];
        }
    }

    getConfig() {
        for (const field of this.fields) {
            this._config[field.name] = Math.round(Number(field.inputElement.value));
        }
        return this._config;
    }
}

export { ActuatorConfigTextInputs };
