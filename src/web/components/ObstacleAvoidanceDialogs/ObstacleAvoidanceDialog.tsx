import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import PlacementErrorDialog from "./PlacementErrorDialog/PlacementErrorDialog";

export default function ObstacleAvoidanceDialog() {
    const jaiaContext = useContext(JaiaContext);
    const placementError = jaiaContext?.placementError;
    if (!placementError) return null;

    return <PlacementErrorDialog message={placementError} />;
}
