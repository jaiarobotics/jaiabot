import { useContext } from "react";

import RoutingActionButton from "./RoutingActionButton";
import {
    describeMissionSetReport,
    describeMissionSetStatus,
    describeReportHeading,
} from "./routing-text";
import { useRoutingAction } from "./use-routing-action";

import { JaiaContext } from "../../context/JaiaContext";
import { buildZoneGeometry } from "../../utils/routing/router";
import { getRoutingStatus } from "../../utils/routing/routing-status";

interface Props {
    onClose: () => void;
}

/**
 * Shows how many missions in the set cross a zone, with Reroute all and Restore all, and
 * reports what this view's last action did.
 */
export default function MissionSetRoutingView({ onClose }: Props) {
    const jaiaContext = useContext(JaiaContext);
    const { running, lastRun, run } = useRoutingAction();

    const missions = Array.from(jaiaContext.missionSet.getMissions().values());
    const routable = missions.filter((mission) => mission.getOriginalWaypoints().length > 0);
    const rerouted = missions.filter((mission) => mission.isRerouted());
    const geometry = buildZoneGeometry(jaiaContext.exclusionZoneSet.getZones());
    const statusLines = describeMissionSetStatus(
        routable.map((mission) => getRoutingStatus(mission, geometry)),
        missions.length,
    );
    const outcomes = lastRun ? jaiaContext.rerouteReport : null;
    const report = lastRun && outcomes ? describeMissionSetReport(lastRun, outcomes) : undefined;

    return (
        <>
            <div className="jaia-panel-title">Mission Set</div>
            {statusLines.map((line) => (
                <p key={line}>{line}</p>
            ))}
            {lastRun && report && (
                <div className="routing-report">
                    <p className="routing-report-heading">{describeReportHeading(lastRun)}</p>
                    <p>{report}</p>
                </div>
            )}
            <div className="routing-buttons">
                <RoutingActionButton
                    label="Reroute all"
                    isRunning={running === "reroute"}
                    disabled={running !== null || routable.length === 0}
                    onClick={() =>
                        run(
                            "reroute",
                            routable.map((mission) => mission.getMissionID()),
                        )
                    }
                />
                <RoutingActionButton
                    label="Restore all"
                    isRunning={running === "restore"}
                    disabled={running !== null || rerouted.length === 0}
                    onClick={() =>
                        run(
                            "restore",
                            rerouted.map((mission) => mission.getMissionID()),
                        )
                    }
                />
            </div>
            <button className="routing-close" onClick={onClose} disabled={running !== null}>
                Close
            </button>
        </>
    );
}
