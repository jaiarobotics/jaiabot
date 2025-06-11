import { useContext } from "react";

import { NodeTypes, BotModes } from "../../types/jaia-system-types";

import "./RemoteControlPanel.less";
import { JaiaContext } from "../../context/JaiaContext";

export default function RemoteControlPanel() {
    const jaiaContext = useContext(JaiaContext);

    if (jaiaContext === null) {
        return;
    }

    if (jaiaContext.selectedNode.type === NodeTypes.BOT) {
        const selectedBot = jaiaContext.bots.get(jaiaContext.selectedNode.id);
        if (selectedBot.getMode() === BotModes.REMOTE_CONTROL) {
            return <div className="remote-control-panel"></div>;
        }
    }
}
