import "./echo.css";
import { byId } from "./domQuery.js";
import { api } from "./api.js";
import { botDropdown } from "./BotDropdown.js";

class EchoApp {
    constructor() {
        this.queryButton = byId("query-echo-status");
        this.queryButton.addEventListener("click", this.queryEchoStatus.bind(this));

        this.startEchoButton = byId("echo-start-btn");
        this.startEchoButton.addEventListener("click", this.startEcho.bind(this));

        this.stopEchoButton = byId("echo-stop-btn");
        this.stopEchoButton.addEventListener("click", this.stopEcho.bind(this));
    }

    updateStatus(status) {
        // Update bounds, if the time is newer on this engineering status
        const selected_bot_id = botDropdown.getSelectedBotId();
        if (selected_bot_id == null) return;

        const thisBot = status.bots[botDropdown.getSelectedBotId()];
        if (thisBot == null) return;

        const engineering_status = thisBot.engineering;

        if (engineering_status == null) return;

        if (engineering_status.echo == null) return;

        if (engineering_status.echo.echo_state == null) return;

        this.updateCurrentEchoStatus(engineering_status.echo.echo_state);
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

    updateCurrentEchoStatus(currentStatus) {
        let element = document.getElementById("echo-current");
        element.textContent = currentStatus;
    }

    queryEchoStatus() {
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

    startEcho() {
        console.log("Start Echo");

        const botId = this.initCheck();

        if (botId === null) {
            // Return early if initCheck failed
            return;
        }

        const engineeringCommand = {
            bot_id: botId,
            echo: {
                start_echo: true,
            },
        };
        api.sendEngineeringCommand(engineeringCommand, true);
    }

    stopEcho() {
        console.log("Stop Echo");

        const botId = this.initCheck();

        if (botId === null) {
            // Return early if initCheck failed
            return;
        }

        const engineeringCommand = {
            bot_id: botId,
            echo: {
                stop_echo: true,
            },
        };
        api.sendEngineeringCommand(engineeringCommand, true);
    }
}

export const echoApp = new EchoApp();
