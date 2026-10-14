import { useContext, useState } from "react";

import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

type RoutingAction = "reroute" | "restore";

/**
 * Runs a reroute or a restore of some missions, and tracks which one is running and which one
 * ran last.
 *
 * A custom React hook: each component that uses it gets its own copy of this state.
 *
 * @returns {object} `running`, the action in progress, or null; `lastRun`, the last action
 * this hook ran, or null; `run`, which starts an action; and `clearLastRun`
 */
export function useRoutingAction() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [running, setRunning] = useState<RoutingAction | null>(null);
    const [lastRun, setLastRun] = useState<RoutingAction | null>(null);

    /**
     * Shows the action as running, then dispatches it once the browser has drawn that.
     *
     * @param {RoutingAction} action Reroute or restore
     * @param {number[]} missionIDs Missions to act on
     * @returns {void}
     */
    const run = (action: RoutingAction, missionIDs: number[]) => {
        setRunning(action);
        // A reroute blocks the page while it runs, so the spinner has to be drawn first
        requestAnimationFrame(() =>
            setTimeout(() => {
                jaiaDispatch({
                    type:
                        action === "reroute"
                            ? JaiaActions.REROUTE_MISSIONS
                            : JaiaActions.RESTORE_ORIGINAL_WAYPOINTS,
                    missionIDs,
                });
                setLastRun(action);
                setRunning(null);
            }),
        );
    };

    return { running, lastRun, run, clearLastRun: () => setLastRun(null) };
}
