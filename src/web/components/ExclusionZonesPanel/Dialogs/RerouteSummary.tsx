import {
    PendingRerouteProposal,
    ProposalStatus,
} from "../../../data/obstacle_avoidance_data/pending-route-data";
import { MAX_WAYPOINTS } from "../../../utils/constants";

interface RerouteSummaryProps {
    proposals: PendingRerouteProposal[];
    overLimitMessage: string;
    impossibleMessage: string;
    /** Suppresses the over-limit section; MissionRerouteDialog uses this for mission-load. */
    showOverLimit?: boolean;
}

export default function RerouteSummary({
    proposals,
    overLimitMessage,
    impossibleMessage,
    showOverLimit = true,
}: RerouteSummaryProps) {
    const overLimit = proposals.filter((p) => p.status === ProposalStatus.OVER_LIMIT);
    const impossible = proposals.filter((p) => p.status === ProposalStatus.IMPOSSIBLE);

    return (
        <>
            {showOverLimit && overLimit.length > 0 && (
                <>
                    <p className="dialog-warn">{overLimitMessage}</p>
                    <ul className="dialog-warn-list">
                        {overLimit.map((p) => (
                            <li key={p.missionID}>
                                Mission {p.missionID}: needs{" "}
                                <strong>{p.newWaypoints.length}</strong> waypoints (limit{" "}
                                {MAX_WAYPOINTS})
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {impossible.length > 0 && (
                <>
                    <p className="dialog-warn">{impossibleMessage}</p>
                    <ul className="dialog-warn-list">
                        {impossible.map((p) => (
                            <li key={p.missionID}>Mission {p.missionID}</li>
                        ))}
                    </ul>
                </>
            )}
        </>
    );
}
