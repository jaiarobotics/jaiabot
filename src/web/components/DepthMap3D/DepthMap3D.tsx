import React, { useContext, useEffect, useState } from "react";
import Icon from "@mdi/react";
import { mdiDockLeft, mdiDockRight, mdiWindowClose, mdiWindowMaximize } from "@mdi/js";
import { Button } from "@mui/material";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { buildDepthMap } from "./depth-map-3D";
import { DEPTH_MAP_3D_NAME } from "../../utils/constants";

interface Props {
    windowPosition: string;
    setWindowPosition: React.Dispatch<React.SetStateAction<string>>;
    onClose: () => void;
}

/**
 * Renders a window displaying the depth map in 3D
 */
export default function DepthMap3D() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [windowPosition, setWindowPosition] = useState("center");

    useEffect(() => {
        buildDepthMap();
    }, [windowPosition]);

    /**
     * Dispatches the action to close the 3D depth map window
     *
     * @returns {void}
     */
    const onClose = () => {
        jaiaDispatch({ type: JaiaActions.CLICKED_BUTTON });
    };

    return (
        <div className={`depth-map-3D-container ${windowPosition}`}>
            <MenuBar
                windowPosition={windowPosition}
                setWindowPosition={setWindowPosition}
                onClose={onClose}
            />
            <div id={DEPTH_MAP_3D_NAME} className="depth-map-3D-plot"></div>
        </div>
    );
}

/**
 * Renders the menu bar at the top of the depth map window
 */
function MenuBar(props: Props) {
    /**
     * Positions the 3D depth map left, right, or center on the JCC
     *
     * @param {string} windowPosition Where to place the 3D depth map
     * @returns {void}
     */
    const handleClick = async (nextPosition: string) => {
        if (nextPosition === props.windowPosition) {
            return;
        }
        // @ts-ignore - plotly.js-dist has no type declarations
        const Plotly = (await import("plotly.js-dist")).default;
        Plotly.purge(DEPTH_MAP_3D_NAME);
        props.setWindowPosition(nextPosition);
    };

    return (
        <div className="depth-menu">
            <button onClick={() => props.onClose()}>
                <Icon path={mdiWindowClose} title="Close Window" color="gray" />
            </button>
            <div></div>
            <Button onClick={() => handleClick("left")}>
                <Icon path={mdiDockLeft} title="Move Left" color="gray" />
            </Button>
            <Button onClick={() => handleClick("center")}>
                <Icon path={mdiWindowMaximize} title="Center" color="gray" />
            </Button>
            <Button onClick={() => handleClick("right")}>
                <Icon path={mdiDockRight} title="Move Right" color="gray" />
            </Button>
        </div>
    );
}
