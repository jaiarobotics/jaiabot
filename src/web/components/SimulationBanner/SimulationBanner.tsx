import { METADATA_POLL_TIME } from "../../utils/constants";
import { useEffect, useState } from "react";
import { jaiaAPI } from "../../utils/jaia-api";
import "./SimulationBanner.less";

export default function SimulationBanner() {
    const [simulationMode, setSimulationMode] = useState(false);

    const fetchSimulationMode = async () => {
        try {
            const metadata = await jaiaAPI.getMetadata();
            setSimulationMode(metadata.is_simulation);
        } catch (error) {
            console.error("Error fetching simulation metadata:", error);
        }
    };

    useEffect(() => {
        fetchSimulationMode();
        const interval = setInterval(fetchSimulationMode, METADATA_POLL_TIME);
        return () => clearInterval(interval);
    }, []);

    if (!simulationMode) return null;

    return (
        <div id="simulation-banner" className="simulation-banner">
            Simulation
        </div>
    );
}
