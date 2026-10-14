import { useContext } from "react";
import { createPortal } from "react-dom";

import RoutingActionButton from "../../RoutingDialog/RoutingActionButton";
import { describeOutcome, describeRoutingStatus } from "../../RoutingDialog/routing-text";
import { useRoutingAction } from "../../RoutingDialog/use-routing-action";

import { JaiaContext, JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JaiaActions } from "../../../../context/jaia-actions";
import Mission from "../../../../data/mission_set/mission";
import { UNASSIGNED_ID } from "../../../../utils/constants";
import { buildZoneGeometry } from "../../../../utils/routing/router";
import { getRoutingStatus } from "../../../../utils/routing/routing-status";

import "../../RoutingDialog/RoutingDialog.less";

interface Props {
    mission: Mission;
    onClose: () => void;
}

/**
 * Shows a mission's routing status, with Reroute and Restore original waypoints, and reports
 * what this dialog's last action did, with an Undo for it.
 */
export default function MissionRoutingDialog({ mission, onClose }: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const { running, lastRun, run, clearLastRun } = useRoutingAction();

    const missionID = mission.getMissionID();
    const botID = jaiaContext.missionsManager.getBotID(missionID);
    const status = getRoutingStatus(
        mission,
        buildZoneGeometry(jaiaContext.exclusionZoneSet.getZones()),
    );
    const outcome = lastRun
        ? jaiaContext.rerouteReport?.find((report) => report.missionID === missionID)
        : undefined;
    // A mission left unchanged has nothing to undo
    const canUndo = outcome?.kind === "changed" || outcome?.kind === "restored";

    /**
     * Backs out this dialog's last action, as the toolbar Undo would.
     *
     * @returns {void}
     */
    const handleUndoClick = () => {
        // Restoring the panel of the previous edit could close this dialog
        jaiaDispatch({ type: JaiaActions.CLICKED_UNDO, keepPanelState: true });
        clearLastRun();
    };

    // Rendered on the body so a positioned panel cannot stack above it
    return createPortal(
        <div className="jaia-dialog-container">
            <div className="blocking-overlay" />
            <div className="jaia-dialog routing-dialog">
                <h1>
                    {`Mission ${missionID} · ${botID === UNASSIGNED_ID ? "Unassigned" : `Bot ${botID}`}`}
                </h1>
                {describeRoutingStatus(status).map((line) => (
                    <p key={line}>{line}</p>
                ))}
                {outcome && (
                    <div className="routing-report">
                        <p>{describeOutcome(outcome)}</p>
                        {canUndo && (
                            <button
                                className="dialog-button"
                                onClick={handleUndoClick}
                                disabled={running !== null}
                            >
                                {lastRun === "reroute" ? "Undo reroute" : "Undo restore"}
                            </button>
                        )}
                    </div>
                )}
                <div className="dialog-button-row">
                    <RoutingActionButton
                        label="Reroute"
                        isRunning={running === "reroute"}
                        disabled={running !== null || mission.getOriginalWaypoints().length === 0}
                        onClick={() => run("reroute", [missionID])}
                    />
                    <RoutingActionButton
                        label="Restore original waypoints"
                        isRunning={running === "restore"}
                        disabled={running !== null || !mission.isRerouted()}
                        onClick={() => run("restore", [missionID])}
                    />
                </div>
                <button className="dialog-button" onClick={onClose} disabled={running !== null}>
                    Close
                </button>
            </div>
        </div>,
        document.body,
    );
}
