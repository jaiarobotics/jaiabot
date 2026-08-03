import ObstacleAvoidanceBaseDialog from "../Common/ObstacleAvoidanceBaseDialog";

interface ZoneCrossingDialogProps {
    waypointNumber: number;
    bypassCount: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ZoneCrossingDialog({
    waypointNumber,
    bypassCount,
    onConfirm,
    onCancel,
}: ZoneCrossingDialogProps) {
    return (
        <ObstacleAvoidanceBaseDialog
            title="Route Crosses a Zone"
            buttons={[
                { label: "Cancel", onClick: onCancel },
                { label: "Add Waypoints", onClick: onConfirm },
            ]}
        >
            <p>
                The path to waypoint {waypointNumber} has been rerouted to include{" "}
                <strong>{bypassCount}</strong> bypass waypoint{bypassCount !== 1 ? "s" : ""}.
            </p>
        </ObstacleAvoidanceBaseDialog>
    );
}
