import { mdiMapMarkerPath } from "@mdi/js";

import MissionStatusIcon, { StatusLevel } from "../../MissionStatusIcon/MissionStatusIcon";

import { RoutingLevel } from "../../../../utils/routing/routing-status";

const STATUSES: Record<RoutingLevel, { level: StatusLevel; label: string }> = {
    [RoutingLevel.CROSSES_ZONE]: { level: "error", label: "the route crosses an exclusion zone" },
    [RoutingLevel.HAS_SUPPRESSED]: {
        level: "warning",
        label: "some waypoints are suppressed and won't run",
    },
    [RoutingLevel.CLEAR]: { level: "normal", label: "nothing to do" },
};

interface Props {
    /** The mission's routing level, undefined when it has no waypoints */
    routingLevel: RoutingLevel | undefined;
}

/** A mission's routing status. Disabled while the mission has no waypoints. */
export default function MissionRoutingButton(props: Props) {
    const { routingLevel } = props;
    const { level, label } =
        routingLevel === undefined
            ? { level: "normal" as const, label: "no waypoints" }
            : STATUSES[routingLevel];
    return (
        <MissionStatusIcon
            level={level}
            iconPath={mdiMapMarkerPath}
            label={`Routing status: ${label}`}
            onClick={() => {}}
            disabled={routingLevel === undefined}
        />
    );
}
