import ObstacleAvoidanceBaseDialog from "../Common/ObstacleAvoidanceBaseDialog";

/**
 * Modal shown when a placement is refused, such as a point inside an exclusion zone or
 * its safety buffer.
 */
export default function PlacementErrorDialog({
    message,
    onDismiss,
}: {
    message: string;
    onDismiss: () => void;
}) {
    return (
        <ObstacleAvoidanceBaseDialog
            title="Placement Not Allowed"
            buttons={[{ label: "OK", onClick: onDismiss }]}
        >
            <p>{message}</p>
        </ObstacleAvoidanceBaseDialog>
    );
}
