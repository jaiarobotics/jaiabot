import React from "react";
const Plotly = require("plotly.js-dist");
import "./DepthContourPlot3D.less";
import { TaskPacket } from "../../shared/JAIAProtobuf";
import { getColorScale } from "./DepthColorMap";
import Icon from "@mdi/react";
import Button from "@mui/material/Button";
import { mdiWindowClose } from "@mdi/js";

interface Props {
    taskPackets: TaskPacket[];
    onClose: () => void;
}

export default function DepthContourPlot3D(props: Props) {
    const topBar = (
        <div className="depth-contour-plot-topbar">
            <Button onClick={props.onClose}>
                <Icon path={mdiWindowClose} title="Close Window"></Icon>
            </Button>
        </div>
    );
    const div = <div id="depth-contour-plot"></div>;

    React.useEffect(() => {
        setupDepthContourPlot3D(props.taskPackets);
    }, []);

    return (
        <div className="depth-contour-plot-container centered rounded shadowed">
            {topBar}
            {div}
        </div>
    );
}

function setupDepthContourPlot3D(taskPackets: TaskPacket[]) {
    const div = document.getElementById("depth-contour-plot");

    const divePackets = taskPackets
        .map((taskPacket) => taskPacket.dive)
        .filter((dive) => dive?.bottom_dive);

    if (divePackets.length == 0) {
        div.innerHTML = "No dive packets to display.";
        return;
    }

    const depths = divePackets.map((dive) => -dive.depth_achieved);
    const topDepth = Math.max(...depths);
    const bottomDepth = Math.min(...depths);
    const depthRange = topDepth - bottomDepth;

    const intensity = depths.map((depth) => (depth - bottomDepth) / depthRange);
    const colorscale = getColorScale();

    var data = [
        {
            opacity: 1.0,
            colorscale: colorscale,
            type: "mesh3d",
            x: divePackets.map((dive) => dive.start_location?.lon),
            y: divePackets.map((dive) => dive.start_location?.lat),
            z: depths,
            intensity: intensity,
            showscale: false,
            contour: {
                color: "black",
                show: true,
                width: 2,
            },
        },
    ];

    const layout = {
        title: {
            text: "Bottom Depth",
        },
        scene: {
            xaxis: {
                title: {
                    text: "Longitude (°)",
                },
            },
            yaxis: {
                title: {
                    text: "Latitude (°)",
                },
            },
            zaxis: {
                title: {
                    text: "Bottom Depth (m)",
                },
            },
        },
    };

    Plotly.newPlot(div, data, layout);
}
