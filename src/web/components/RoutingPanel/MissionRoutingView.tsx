import { useContext } from "react";

import RoutingActionButton from "./RoutingActionButton";
import { describeOutcome, describeReportHeading, describeRoutingStatus } from "./routing-text";
import { useRoutingAction } from "./use-routing-action";

import { JaiaContext } from "../../context/JaiaContext";
import Mission from "../../data/mission_set/mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { buildZoneGeometry } from "../../utils/routing/router";
import { getRoutingStatus } from "../../utils/routing/routing-status";

interface Props {
    mission: Mission;
    onClose: () => void;
}

/**
 * Shows a mission's routing status, with Reroute and Restore original waypoints, and reports
 * what this view's last action did.
 */
export default function MissionRoutingView({ mission, onClose }: Props) {
    const jaiaContext = useContext(JaiaContext);
    const { running, lastRun, run } = useRoutingAction();

    const missionID = mission.getMissionID();
    const botID = jaiaContext.missionsManager.getBotID(missionID);
    const status = getRoutingStatus(
        mission,
        buildZoneGeometry(jaiaContext.exclusionZoneSet.getZones()),
    );
    const outcome = lastRun
        ? jaiaContext.rerouteReport?.find((report) => report.missionID === missionID)
        : undefined;

    return (
        <>
            <div className="jaia-panel-title">
                {`Mission ${missionID} · ${botID === UNASSIGNED_ID ? "Unassigned" : `Bot ${botID}`}`}
            </div>
            {describeRoutingStatus(status).map((line) => (
                <p key={line}>{line}</p>
            ))}
            {lastRun && outcome && (
                <div className="routing-report">
                    <p className="routing-report-heading">{describeReportHeading(lastRun)}</p>
                    <p>{describeOutcome(outcome)}</p>
                </div>
            )}
            <div className="routing-buttons">
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
            <button className="routing-close" onClick={onClose} disabled={running !== null}>
                Close
            </button>
        </>
    );
}
