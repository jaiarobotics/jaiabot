import React, { useContext } from "react";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaContextType, JaiaAction } from "../../types/context-types";

import { NodeTypes } from "../../types/jaia-system-types";
import { HealthState } from "../../types/protobuf-types";
import { Link } from "../../shared/JAIAProtobuf";
import { isDisconnected } from "../BotDetails/bot-details";
import { CLOUD_HUB_ID } from "../../utils/constants";
import "./NodeList.less";

/**
 * Displays the Fleet, Hub, and Bot tabs on the left side of the JCC
 */
export default function NodeList() {
    const jaiaContext: JaiaContextType = useContext(JaiaContext);
    const JaiaDispatch: React.Dispatch<JaiaAction> = useContext(JaiaDispatchContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    const hubs = Array.from(jaiaContext.hubs.getHubs().values());
    const bots = Array.from(jaiaContext.bots.getBots().values());

    const fleetID = hubs[0]?.getFleetID() ?? 1;

    const allHealthStates = [
        ...hubs.map((hub) => hub.getHealthState()),
        ...bots.map((bot) => bot.getHealthState()),
    ].filter((healthState) => healthState !== undefined);

    const fleetHealthState =
        allHealthStates.length === 0
            ? HealthState.HEALTH__OK
            : allHealthStates.reduce((maxState, state) =>
                  state > maxState ? state : maxState,
              );

    const fleetStatusAge = Math.max(
        0,
        ...hubs.map((hub) => hub.getStatusAge()),
        ...bots.map((bot) => bot.getStatusAge()),
    );

    /**
     * Dispatches the CLICKED_NODE action to JaiaContext for further handling
     */
    const handleClick = (nodeType: NodeTypes, nodeID: number) => {
        JaiaDispatch({
            type: JaiaActions.CLICKED_NODE,
            clickedNode: { type: nodeType, id: nodeID },
        });
    };

    function getClassName(
        nodeType: NodeTypes,
        nodeID: number,
        healthState: HealthState,
        statusAge: number,
        link?: Link,
    ) {
        const faultLevel: Map<HealthState, number> = new Map([
            [HealthState.HEALTH__OK, 0],
            [HealthState.HEALTH__DEGRADED, 1],
            [HealthState.HEALTH__FAILED, 2],
        ]);

        const nodeTypeClass =
            nodeType === NodeTypes.BOT
                ? "bot-item"
                : nodeType === NodeTypes.HUB
                  ? "hub-item"
                  : "fleet-item";
        const faultLevelClass = "faultLevel" + faultLevel.get(healthState);
        const selectedNode = jaiaContext.jaiaGlobal.getSelectedNode();
        const selectedClass =
            selectedNode.type === nodeType && selectedNode.id === nodeID ? "selected" : "";

        const disconnectedClass = isDisconnected(statusAge, link) ? "disconnected" : "";

        return `node-item ${nodeTypeClass} ${faultLevelClass} ${selectedClass} ${disconnectedClass}`;
    }

    if (hubs.length === 0 && bots.length === 0) {
        return;
    }

    return (
        <div id="nodeList" data-testid="nodeList">
            <div
                key={`fleet-${fleetID}`}
                onClick={() => handleClick(NodeTypes.FLEET, fleetID)}
                className={getClassName(NodeTypes.FLEET, fleetID, fleetHealthState, fleetStatusAge)}
            >
                <div className="fleet-label">
                    <span className="fleet-text">FLEET</span>
                    <span className="fleet-number">{fleetID}</span>
                </div>
            </div>
            {hubs.map((hub) => (
                <div
                    key={`hub-${hub.getHubID()}`}
                    onClick={() => handleClick(NodeTypes.HUB, hub.getHubID())}
                    className={getClassName(
                        NodeTypes.HUB,
                        hub.getHubID(),
                        hub.getHealthState(),
                        hub.getStatusAge(),
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
                        bot.getStatusAge(),
                        bot.getLink(),
                    )}
                >
                    {bot.getBotID()}
                </div>
            ))}
        </div>
    );
}
