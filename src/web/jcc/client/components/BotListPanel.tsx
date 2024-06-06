import React, { useContext } from "react"
import { GlobalContext, GlobalDispatchContext, PodElement } from "../../../context/GlobalContext"
import { GlobalActions } from "../../../context/actions/GlobalActions"

import { HubStatus, BotStatus, HealthState } from "./shared/JAIAProtobuf"
import { PodStatus, PortalBotStatus } from "./shared/PortalStatus"


interface Props {
    podStatus: PodStatus | null
    selectedBotId: number | null
    selectedHubId: number | null
    trackedBotId: string | number | null
    didClickBot: (bot_id: number) => void
    didClickHub: (hub_id: number) => void
}


function faultLevel(health_state: HealthState) {
    return {
        'HEALTH__OK': 0,
        'HEALTH__DEGRADED': 1,
        'HEALTH__FAILED': 2
    }[health_state] ?? 0
}

export function BotListPanel(props: Props) {
    if (props.podStatus == null) return null

    function compareByHubId(hub1: HubStatus, hub2: HubStatus) {
        return hub1.hub_id - hub2.hub_id
    }

    function compareByBotId(bot1: BotStatus, bot2: BotStatus) {
        return bot1.bot_id - bot2.bot_id
    }

    let bots = Object.values(props.podStatus?.bots ?? {}).sort(compareByBotId)
    let hubs = Object.values(props.podStatus?.hubs ?? {}).sort(compareByHubId)
    
    function BotTab(bot: PortalBotStatus) {
        const globalDispatch = useContext(GlobalDispatchContext)

        var key = 'bot-' + bot.bot_id
        var botClass = 'bot-item'


        let faultLevelClass = 'faultLevel' + faultLevel(bot.health_state)
        let selected = bot.bot_id == props.selectedBotId ? 'selected' : ''
        let tracked = bot.bot_id == props.trackedBotId ? 'tracked' : ''
        let disconnected = Math.max(0.0, bot.portalStatusAge / 1e6) > 30 ? 'disconnected' : ''

        /**
         * Triggers the handling logic in CommandControl and dispatches the event to GlobalContext
         * 
         * @returns {void}
         * 
         * @notes
         * This is an instance where we are beginning to migrate from CommandControl state to context
         */
        const handleClick = () => {
            globalDispatch({ type: GlobalActions.CLICKED_BOT_TAB })
            props.didClickBot(bot.bot_id)
        }

        return (
            <div
                key={key}
                onClick={handleClick}
                className={`${botClass} ${faultLevelClass} ${selected} ${tracked} ${disconnected}`}
            >
                { bot.bot_id }
            </div>
        );

    }

    function HubTab(hub: HubStatus) {
        const globalContext = useContext(GlobalContext)
        const globalDispatch = useContext(GlobalDispatchContext)

        var key = 'hub-' + hub.hub_id
        var bothubClass = 'hub-item'

        let faultLevelClass = 'faultLevel' + faultLevel(hub.health_state)
        
        let selected = ''
        
        if (globalContext.selectedPodElement !== null 
            && globalContext.selectedPodElement.type === PodElement.HUB) {
                selected = 'selected'
        }

        /**
         * Triggers the handling logic in CommandControl and dispatches the event to GlobalContext
         * 
         * @returns {void}
         * 
         * @notes
         * This is an instance where we are beginning to migrate from CommandControl state to context
         */
        const handleClick = () => {
            props.didClickHub(hub.hub_id)
            globalDispatch({ type: GlobalActions.CLICKED_HUB_TAB, hubID: hub.hub_id })
        }

        //For now we are naming HUB, HUB with no id
        //In the future we will have to revisit this
        return (
            <div
                key={key}
                onClick={handleClick}
                className={`${bothubClass} ${faultLevelClass} ${selected}`}
            >
                {"HUB"} 
            </div>
        );
    }


    return (
        <div id="botsList">
            {
                hubs.map(HubTab)
            }
            {
                bots.map(BotTab)
            }
        </div>
    )
}
