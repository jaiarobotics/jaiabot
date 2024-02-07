import { byId } from './domQuery.js' 
import { api } from './api.js'
import { botDropdown } from './BotDropdown.js'

class EchoApp {
    constructor() {
        this.queryButton = byId('query-echo-status')
        this.queryButton.addEventListener('click', this.queryEchoStatus.bind(this))

        this.startEchoButton = byId('echo-start-btn')
        this.startEchoButton.addEventListener('click', this.startEcho.bind(this))


    }

    initCheck(botId) {
        if (botId === "0") {
            alert("Please select a bot first")
            return
        }

        if (!api.inControl) {
            alert("We are not in control yet.  Please press 'Take Control' if you'd like to take control.")
            return
        }
    }

    queryEchoStatus() {
        const botId = botDropdown.getSelectedBotId()
        this.initCheck(botId);

        const engineeringCommand = {
            bot_id: botId,
            query_engineering_status: true
        }

        api.sendEngineeringCommand(engineeringCommand, true)
    }

    startEcho() {
        const botId = botDropdown.getSelectedBotId()
        this.initCheck(botId);

        const engineeringCommand = {
            bot_id: botId,
            echo: {
                start_echo: true
            }
        }
        api.sendEngineeringCommand(engineeringCommand, true)
    }

}


export const echoApp = new EchoApp()