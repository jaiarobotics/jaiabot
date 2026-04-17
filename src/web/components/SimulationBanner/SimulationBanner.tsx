import { useContext } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import "./SimulationBanner.less";

/**
 * Displays the simulation indicator in the JCC
 */
export default function SimulationBanner() {
    const jaiaContext = useContext(JaiaContext);

    if (!jaiaContext) {
        return null;
    }

    if (jaiaContext.jaiaGlobal.getMetadata()?.is_simulation) {
        return <div className="simulation-banner">Simulation</div>;
    }

    return null;
}
