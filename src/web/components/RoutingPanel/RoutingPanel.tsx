import { useContext } from "react";

import MissionRoutingView from "./MissionRoutingView";
import MissionSetRoutingView from "./MissionSetRoutingView";

import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { ButtonNames, ButtonTypes } from "../../types/context-types";

import "./RoutingPanel.less";

/**
 * Shows the routing status of one mission, or of the whole mission set, with its reroute and
 * restore actions. Close opens the Missions panel.
 */
export default function RoutingPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches the action to open the Missions panel
     *
     * @returns {void}
     */
    const handleClose = () => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: ButtonTypes.PANEL,
            buttonName: ButtonNames.MISSIONS_PANEL,
        });
    };

    const target = jaiaContext.jaiaGlobal.getRoutingTarget();
    const mission =
        target.kind === "mission" ? jaiaContext.missionSet.getMission(target.missionID) : undefined;

    return (
        <div className="jaia-panel routing-panel">
            {target.kind === "missionSet" ? (
                <MissionSetRoutingView onClose={handleClose} />
            ) : mission ? (
                <MissionRoutingView
                    key={target.missionID}
                    mission={mission}
                    onClose={handleClose}
                />
            ) : (
                <>
                    <p>{`Mission ${target.missionID} no longer exists.`}</p>
                    <button className="routing-close" onClick={handleClose}>
                        Close
                    </button>
                </>
            )}
        </div>
    );
}
