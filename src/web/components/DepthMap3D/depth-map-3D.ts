import type { Data, Layout } from "plotly.js-dist";

import colors from "./colors.json";
import { taskPackets } from "../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../data/task_packets/task-packet-filter";
import { DEPTH_MAP_3D_NAME } from "../../utils/constants";
import "./DepthMap3D.less";

/**
 * Processes the colors to be used in the depth map
 *
 * @returns {number[]} Colors to be used in the depth map
 */
export function getColorScale(): [number, string][] {
    const n = Math.max(2, colors.length);
    return colors.map((rgb, index) => [index / (n - 1), `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`]);
}

/**
 * Scales depths to 0–1 for the color scale, deepest = 0.
 *
 * @param {number[]} depths Depths (negative, metres)
 * @returns {number[]} Color intensity per depth
 *
 * @notes
 * When every depth is the same there is no range to scale over, so all intensities are 0.
 */
export function getDepthIntensities(depths: number[]) {
    const bottomDepth = Math.min(...depths);
    const depthRange = Math.max(...depths) - bottomDepth;
    if (depthRange === 0) {
        return depths.map(() => 0);
    }
    return depths.map((depth) => (depth - bottomDepth) / depthRange);
}

/**
 * Passes the dive data from the Bots to plotly for a 3D rendering
 *
 * @returns {Promise<boolean>} True if the plot is generated, false otherwise
 */
export async function buildDepthMap() {
    const root = document.getElementById(DEPTH_MAP_3D_NAME);

    if (!root) {
        return false;
    }

    const bottomDivePackets = taskPacketFilter
        .filter(taskPackets.getIncludedTaskPackets())
        .map((taskPacket) => taskPacket.dive)
        .filter((dive) => dive?.bottom_dive);

    if (bottomDivePackets.length === 0) {
        return false;
    }

    const depths = bottomDivePackets.map((dive) => dive.depth_achieved * -1);
    const intensity = getDepthIntensities(depths);
    const colorScale = getColorScale();

    const data: Data[] = [
        {
            opacity: 1.0,
            colorscale: colorScale,
            type: "mesh3d",
            x: bottomDivePackets.map((dive) => dive.start_location?.lon),
            y: bottomDivePackets.map((dive) => dive.start_location?.lat),
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

    const layout: Partial<Layout> = {
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
                range: [-60.0, 0.0] as [number, number],
            },
        },
    };

    const Plotly = (await import("plotly.js-dist")).default;
    Plotly.newPlot(root, data, layout);
    return true;
}
