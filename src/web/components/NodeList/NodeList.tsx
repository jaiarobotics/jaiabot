import React, { useContext } from "react";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaContextType, JaiaAction } from "../../types/context-types";

import { NodeTypes } from "../../types/jaia-system-types";
import { HealthState } from "../../shared/proto/goby/middleware/protobuf/coroner";
import { CLOUD_HUB_ID } from "../../utils/constants";
import "./NodeList.less";

/**
 * Displays the Hub and Bot tabs on the left side of the JCC
 */
export default function NodeList() {
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const JaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    const hubs = Array.from(jaiaContext.hubs.getHubs().values());
    const bots = Array.from(jaiaContext.bots.getBots().values());

    /**
     * Dispatches the CLICKED_NODE action to JaiaContext for further handling
     *
     * @param {NodeTypes} nodeType Indicates Bot or Hub
     * @param {number} nodeID Provides Bot or Hub ID
     * @returns {void}
     */
    const handleClick = (nodeType: NodeTypes, nodeID: number) => {
        JaiaDispatch({
            type: JaiaActions.CLICKED_NODE,
            clickedNode: { type: nodeType, id: nodeID },
        });
    };

    /**
     * Creates the class name that applies the correct style to a node item
     * based on type, selection, and health
     *
     * @param {NodeTypes} nodeType Indicates Bot or Hub
     * @param {number} nodeID Provides ID of Bot or Hub
     * @param {HealthState} healthState Determines color of node item
     * @param {boolean} isCommsDropped Indicates whether the node is currently experiencing dropped comms
     * @returns {string} Class name that sets correct style
     */
    function getClassName(
        nodeType: NodeTypes,
        nodeID: number,
        healthState: HealthState,
        isCommsDropped?: boolean,
    ) {
        const faultLevel: Map<HealthState, number> = new Map([
            [HealthState.HEALTH__OK, 0],
            [HealthState.HEALTH__DEGRADED, 1],
            [HealthState.HEALTH__FAILED, 2],
        ]);

        const nodeTypeClass = nodeType === NodeTypes.BOT ? "bot-item" : "hub-item";
        const faultLevelClass = "faultLevel" + faultLevel.get(healthState);
        const selectedNode = jaiaContext.jaiaGlobal.getSelectedNode();
        const selectedClass =
            selectedNode.type === nodeType && selectedNode.id === nodeID ? "selected" : "";

        const disconnectedClass = isCommsDropped ? "disconnected" : "";

        return `node-item ${nodeTypeClass} ${faultLevelClass} ${selectedClass} ${disconnectedClass}`;
    }

    if (hubs.length === 0 && bots.length === 0) {
        return;
    }

    return (
        <div id="nodeList" data-testid="nodeList">
            {hubs.map((hub) => (
                <div
                    key={`hub-${hub.getHubID()}`}
                    onClick={() => handleClick(NodeTypes.HUB, hub.getHubID())}
                    className={getClassName(
                        NodeTypes.HUB,
                        hub.getHubID(),
                        hub.getHealthState(),
                        hub.isCommsDropped(),
                    )}
                >
                    <div className="hub-label">
                        <span className="hub-text">HUB</span>
                        <span className="hub-number">
                            {hub.getHubID() === CLOUD_HUB_ID ? "Cloud" : hub.getHubID()}
                        </span>
                    </div>
                </div>
            ))}
            {bots.map((bot) => (
                <div
                    key={`bot-${bot.getBotID()}`}
                    onClick={() => handleClick(NodeTypes.BOT, bot.getBotID())}
                    className={getClassName(
                        NodeTypes.BOT,
                        bot.getBotID(),
                        bot.getHealthState(),
                        bot.isCommsDropped(),
                    )}
                >
                    {bot.getBotID()}
                </div>
            ))}
        </div>
    );
}
