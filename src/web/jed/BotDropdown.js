import { byId } from "./domQuery.js";

class BotDropdown {
    constructor(elementId) {
        this.selectElement = byId(elementId);
        if (this.selectElement == null) {
            console.warn(`Couldn't find element with id="${elementId}"`);
        }
    }

    getSelectedBotId() {
        return this.selectElement?.value || "0";
    }

    updateWithBots(bots) {
        if (bots == null) return;

        let existingBotIds = Array.from(this.selectElement.getElementsByTagName("option")).map(
            (element) => element.value,
        );
        let newBotIds = Object.keys(bots);

        // Only change menu if it's different
        if (newBotIds.length == existingBotIds.length) {
            var same = true;
            for (let i = 0; i < newBotIds.length; i++) {
                if (newBotIds[i] != existingBotIds[i]) {
                    same = false;
                    break;
                }
            }
        }

        if (same) {
            return;
        }

        // Clear select options
        while (this.selectElement.firstChild) {
            this.selectElement.removeChild(this.selectElement.firstChild);
        }

        // Rebuild the options
        for (let botId in bots) {
            let optionElement = document.createElement("option");
            optionElement.setAttribute("value", botId);
            let textNode = document.createTextNode(botId);
            optionElement.appendChild(textNode);

            this.selectElement.appendChild(optionElement);
        }
    }
}

const botDropdown = new BotDropdown("botSelect");

export { BotDropdown, botDropdown };
