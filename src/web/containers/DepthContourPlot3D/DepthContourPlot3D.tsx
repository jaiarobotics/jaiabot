import React from "react";
const Plotly = require("plotly.js-dist");
import "./DepthContourPlot3D.less";

interface Props {}

export default function DepthContourPlot3D(props: Props) {
    const div = <div id="depth-contour-plot"></div>;

    React.useEffect(() => {
        setupDepthContourPlot3D();
    }, []);

    return <div className="depth-contour-plot-container">{div}</div>;
}

function setupDepthContourPlot3D() {
    const div = document.getElementById("depth-contour-plot");

    Plotly.newPlot(
        div,
        [
            {
                x: [1, 2, 3, 4, 5],

                y: [1, 2, 4, 8, 16],
            },
        ],
        {
            margin: { t: 0 },
        },
    );
}
