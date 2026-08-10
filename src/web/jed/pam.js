import "./pam.css";
import { byId } from "./domQuery.js";
import { api } from "./api.js";
import { botDropdown } from "./BotDropdown.js";

class PamApp {
    constructor() {
        this.queryButton = byId("query-pam-status");
        this.queryButton.addEventListener("click", this.queryPamStatus.bind(this));

        this.startPamButton = byId("pam-start-btn");
        this.startPamButton.addEventListener("click", this.startPam.bind(this));

        this.stopPamButton = byId("pam-stop-btn");
        this.stopPamButton.addEventListener("click", this.stopPam.bind(this));
    }

    updateStatus(status) {
        // Update bounds, if the time is newer on this engineering status
        const selected_bot_id = botDropdown.getSelectedBotId();
        if (selected_bot_id == null) return;

        const thisBot = status.bots[botDropdown.getSelectedBotId()];
        if (thisBot == null) return;

        const engineering_status = thisBot.engineering;

        if (engineering_status == null) return;

        if (engineering_status.pam == null) return;

        if (engineering_status.pam.pam_state == null) return;

        this.updateCurrentPamStatus(engineering_status.pam.pam_state);
    }

    initCheck() {
        const botId = botDropdown.getSelectedBotId();

        if (botId === "0") {
            alert("Please select a bot first");
            return null;
        }

        if (!api.inControl) {
            alert(
                "We are not in control yet.  Please press 'Take Control' if you'd like to take control.",
            );
            return null;
        }

        return botId;
    }

    updateCurrentPamStatus(currentStatus) {
        let element = document.getElementById("pam-current");
        element.textContent = currentStatus;
    }

    queryPamStatus() {
        const botId = this.initCheck();

        if (botId === null) {
            // Return early if initCheck failed
            return;
        }

        const engineeringCommand = {
            bot_id: botId,
            query_engineering_status: true,
        };

        api.sendEngineeringCommand(engineeringCommand, true);
    }

    startPam() {
        console.log("Start PAM");

        const botId = this.initCheck();

        if (botId === null) {
            // Return early if initCheck failed
            return;
        }

        const engineeringCommand = {
            bot_id: botId,
            pam: {
                start_pam: true,
            },
        };
        api.sendEngineeringCommand(engineeringCommand, true);
    }

    stopPam() {
        console.log("Stop PAM");

        const botId = this.initCheck();

        if (botId === null) {
            // Return early if initCheck failed
            return;
        }

        const engineeringCommand = {
            bot_id: botId,
            pam: {
                stop_pam: true,
            },
        };
        api.sendEngineeringCommand(engineeringCommand, true);
    }
}

export const pamApp = new PamApp();
