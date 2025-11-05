import { useEffect, useState } from "react";
import { METADATA_POLL_TIME } from "../../utils/constants";
import { jaiaAPI } from "../../utils/jaia-api";
import "./SimulationBanner.less";

/**
 * Displays the simulation indicator in the JCC
 */
export default function SimulationBanner() {
    const [simulationMode, setSimulationMode] = useState(false);

    /**
     * Retrieves the metadata message from the server to
     * update the simulationMode property
     *
     * @returns {void}
     */
    const fetchSimulationMode = async () => {
        try {
            const metadata = await jaiaAPI.getMetadata();
            setSimulationMode(metadata.is_simulation);
        } catch (error) {
            console.error("Error fetching metadata for simulation banner:", error);
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchSimulationMode, METADATA_POLL_TIME);
        return () => clearInterval(interval);
    }, []);

    if (!simulationMode) return;

    return <div className="simulation-banner">Simulation</div>;
}
