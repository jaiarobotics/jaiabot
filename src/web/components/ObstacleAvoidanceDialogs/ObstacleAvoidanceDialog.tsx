import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import MissionRerouteDialog from "./MissionRerouteDialog/MissionRerouteDialog";
import WaypointRemovalDialog from "./WaypointRemovalDialog/WaypointRemovalDialog";
import PlacementErrorDialog from "./PlacementErrorDialog/PlacementErrorDialog";

export default function ObstacleAvoidanceDialog() {
    const jaiaContext = useContext(JaiaContext);
    const pending = jaiaContext?.obstacleAvoidanceData.getPendingDialog();
    if (!pending) return null;

    switch (pending.type) {
        case "reroute":
            return <MissionRerouteDialog pending={pending.data} />;
        case "waypointRemoval":
            return <WaypointRemovalDialog pending={pending.data} />;
        case "placementError":
            return <PlacementErrorDialog message={pending.message} />;
    }
}
