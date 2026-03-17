import { useContext, useEffect, useState } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import { jaiaAPI } from "../../utils/jaia-api";
import { Metadata } from "../../types/protobuf-types";
import "./SimulationBanner.less";

/**
 * Displays the simulation indicator in the JCC
 */
export default function SimulationBanner() {
    const [isSimulation, setIsSimulation] = useState(false);
    const jaiaContext = useContext(JaiaContext);

    // Get metadata before first iteration of interval (10 second delay)
    useEffect(() => {
        jaiaAPI.getMetadata().then((metadata: Metadata) => {
            if (metadata?.is_simulation) {
                setIsSimulation(true);
            }
        });
    }, []);

    if (!isSimulation && !jaiaContext) {
        return null;
    }

    if (isSimulation || jaiaContext.jaiaGlobal.getMetadata()?.is_simulation) {
        return <div className="simulation-banner">Simulation</div>;
    }

    return null;
}
