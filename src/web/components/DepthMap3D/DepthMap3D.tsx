import React, { useEffect, useState } from "react";
import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDockLeft, mdiDockRight, mdiWindowClose, mdiWindowMaximize } from "@mdi/js";
import { buildDepthMap } from "./depth-map-3D";
import { DEPTH_MAP_3D_NAME } from "../../utils/constants";

const Plotly = require("plotly.js-dist");

interface Props {
    setWindowPosition: React.Dispatch<React.SetStateAction<string>>;
}

export default function DepthMap3D() {
    const [windowPosition, setWindowPosition] = useState("center");

    useEffect(() => {
        buildDepthMap();
    }, [windowPosition]);

    return (
        <div className="depth-map-3D-container">
            <div className="depth-map"></div>
            <MenuBar setWindowPosition={setWindowPosition} />
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
            <Button>
                <Icon path={mdiWindowClose} title="Close Window" />
            </Button>
            <Button onClick={() => handleClick("left")}>
                <Icon path={mdiDockLeft} title="Move Left" />
            </Button>
            <Button onClick={() => handleClick("center")}>
                <Icon path={mdiWindowMaximize} title="Center" />
            </Button>
            <Button onClick={() => handleClick("right")}>
                <Icon path={mdiDockRight} title="Move Right" />
            </Button>
        </div>
    );
}
