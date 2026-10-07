import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import PlacementErrorDialog from "./PlacementErrorDialog/PlacementErrorDialog";

export default function ObstacleAvoidanceDialog() {
    const jaiaContext = useContext(JaiaContext);
    const pending = jaiaContext?.obstacleAvoidanceData.getPendingChange();
    if (!pending) return null;

    return <PlacementErrorDialog message={pending.message} />;
}
