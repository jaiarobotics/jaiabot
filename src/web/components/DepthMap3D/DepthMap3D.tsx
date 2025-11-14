import React, { useContext, useEffect, useState } from "react";
import Icon from "@mdi/react";
import { mdiDockLeft, mdiDockRight, mdiWindowClose, mdiWindowMaximize } from "@mdi/js";
import { Button } from "@mui/material";
import { JaiaActions } from "../../context/jaia-actions";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { buildDepthMap } from "./depth-map-3D";
import { DEPTH_MAP_3D_NAME } from "../../utils/constants";

const Plotly = require("plotly.js-dist");

interface Props {
    setWindowPosition: React.Dispatch<React.SetStateAction<string>>;
    onClose: () => void;
}

export default function DepthMap3D() {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [windowPosition, setWindowPosition] = useState("center");

    useEffect(() => {
        buildDepthMap();
    }, [windowPosition]);

    const onClose = () => {
        jaiaDispatch({ type: JaiaActions.CLICKED_BUTTON });
    };

    return (
        <div className={`depth-map-3D-container ${windowPosition}`}>
            <MenuBar setWindowPosition={setWindowPosition} onClose={onClose} />
            <div id={DEPTH_MAP_3D_NAME}></div>
        </div>
    );
}

function MenuBar(props: Props) {
    const handleClick = (windowPosition: string) => {
        Plotly.purge(DEPTH_MAP_3D_NAME);
        props.setWindowPosition(windowPosition);
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
