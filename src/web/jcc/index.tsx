import * as ReactDOM from "react-dom/client";
import App from "./App";
import {
    DATA_MODEL_POLL_TIME,
    GITHUB_POLL_TIME,
    INTERNET_POLL_TIME,
    METADATA_POLL_TIME,
    TASK_PACKET_POLL_TIME,
} from "../utils/constants";
import { pollGitHub, pollInternet, pollMetadata, pollStatus, pollTaskPackets } from "./polling";
import { fallBackToNaturalEarthWithoutInternet } from "../openlayers/layers/tile/base-map-fallback";

// Make initial calls
pollStatus();
pollTaskPackets();
pollMetadata();
pollGitHub();
// Only after the first check: a later one that times out on a slow link mustn't change the map under the operator
pollInternet().then(fallBackToNaturalEarthWithoutInternet);

// Start intervals
const statusInterval = setInterval(async () => pollStatus(), DATA_MODEL_POLL_TIME);
const taskPacketInterval = setInterval(async () => pollTaskPackets(), TASK_PACKET_POLL_TIME);
const metadataInterval = setInterval(async () => pollMetadata(), METADATA_POLL_TIME);
const gitHubInterval = setInterval(async () => pollGitHub(), GITHUB_POLL_TIME);
const internetInterval = setInterval(async () => pollInternet(), INTERNET_POLL_TIME);

let element = document.getElementById("root");
const root = ReactDOM.createRoot(element);
root.render(<App />);

// Prefetch Plotly in the background immediately after app renders.
// It is only used by DepthMap3D but we want it ready before the user opens that panel.
import(/* webpackPrefetch: true */ "plotly.js-dist");

import.meta.webpackHot?.accept();
