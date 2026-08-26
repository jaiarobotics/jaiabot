import { mdiDownload, mdiUpload, mdiTrashCan, mdiRuler, mdiInformation } from "@mdi/js";
import Icon from "@mdi/react";
import React from "react";

import JaiaMap from "./JaiaMap";
import LogSelector from "./LogSelector";
import TimeSlider from "./TimeSlider";
import { Plots } from "./Plots";

import { createMeasureInteraction } from "../tools/interactions";
import { LogApi } from "../model/LogApi";
import { Plot } from "../model/Plot";
import { SeriesDescriptor } from "../model/SeriesDescriptor";
import { Draw } from "ol/interaction";

import "../styles/styles.css";
import { CustomAlert, CustomAlertProps } from "../shared/CustomAlert";

import Button from "@mui/material/Button";
import { InformationDialog } from "./InformationDialog";

function exceptionCatcher(exception: Error) {
    CustomAlert.presentAlert({
        title: exception.name,
        text: exception.message,
    });
}

const loadingImage = require("../images/loading.gif");

var Plotly = require("plotly.js-dist");

const APP_NAME = "Jaia Data Vision";

const formatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "medium" });

interface AppProps {}

interface State {
    isSelectingLogs: boolean;
    chosenLogs: string[];
    chosenLogName: string;
    plots: Plot[];
    layerSwitcherVisible: boolean;
    measureResultVisible: boolean;
    measureMagnitude: string;
    measureUnit: string;
    timeFraction: number | null;
    t: number | null; // Currently selected time
    tMin: number | null; // Minimum time for these logs
    tMax: number | null; // Maximum time for these logs
    visibleTimeRange: number[]; // Time range visible on plots and map

    // Modal busy indicator
    isBusy: boolean;

    // Custom Alert shown, if any
    customAlert?: React.JSX.Element;

    // Showing the information dialog?
    isInformationDialogVisible: boolean;
}

export class App extends React.Component<AppProps, State> {
    declare state: State;
    map: JaiaMap;
    plot_div_element: any;
    seriesDescriptors: SeriesDescriptor[];

    constructor(props: AppProps) {
        super(props);

        this.state = {
            isSelectingLogs: false,
            chosenLogs: [],
            chosenLogName: "",
            plots: [],
            layerSwitcherVisible: false,
            measureResultVisible: false,
            measureMagnitude: "",
            measureUnit: "",
            timeFraction: null,
            t: null, // Currently selected time
            tMin: null, // Minimum time for these logs
            tMax: null, // Maximum time for these logs
            visibleTimeRange: [0, 2 ** 60], // Include every data point
            isBusy: false,
            customAlert: null,
            isInformationDialogVisible: false,
        };

        CustomAlert.setPresenter((props: CustomAlertProps | null) => {
            if (props == null) {
                this.setState({ customAlert: null });
                return;
            }

            this.setState({
                customAlert: <CustomAlert {...props}></CustomAlert>,
            });
        });
    }

    render() {
        const self = this;

        // Show log selection box?
        const log_selector = this.state.isSelectingLogs ? <LogSelector delegate={this} /> : null;

        var busyOverlay = this.state.isBusy ? (
            <div className="busy-overlay">
                <img src={loadingImage} className="busy-icon"></img>
            </div>
        ) : null;

        console.debug("Rendering App with state:", this.state);

        return (
            <div className="vertical flexbox maximized">
                <div className="vertical flexbox top_pane padded">
                    <div className="row">
                        <img src="favicon.png" className="jaia-icon" />
                        <h2 className="appName">{APP_NAME}</h2>
                    </div>
                </div>

                <div className="flexbox horizontal" style={{ alignItems: "center" }}>
                    <button
                        className="padded logButton"
                        onClick={self.selectLogButtonPressed.bind(self)}
                    >
                        Select Log(s)
                    </button>
                    {this.chosenLogsListElement()}
                </div>

                <div className="bottomPane flexbox horizontal">
                    <Plots
                        chosenLogs={this.state.chosenLogs}
                        plots={this.state.plots}
                        t={this.state.t}
                        delegate={this}
                        visibleTimeRange={this.state.visibleTimeRange}
                        seriesDescriptors={this.seriesDescriptors}
                    />

                    <div id="mapPane" className="rounded clipped shadowed margin">
                        <div className="openlayers-map" id="openlayers-map"></div>

                        <div id="mapControls">
                            <button
                                id="layerSwitcherToggler"
                                className="mapButton"
                                onClick={() => {
                                    this.togglerLayerSwitcher();
                                }}
                            >
                                Layers
                            </button>

                            <button
                                id="kmlExportButton"
                                className="mapButton"
                                onClick={() => {
                                    this.map.exportKml();
                                }}
                            >
                                <Icon path={mdiDownload} size={1}></Icon>
                                KMZ
                            </button>

                            <button
                                id="kmlImportButton"
                                className="mapButton"
                                onClick={() => {
                                    this.map.importKmx();
                                }}
                            >
                                <Icon path={mdiUpload} size={1}></Icon>
                                KMZ
                            </button>

                            <button
                                id="ubxExportButton"
                                className="mapButton"
                                onClick={this.ubxDownloadButtonPressed.bind(this)}
                            >
                                <Icon path={mdiDownload} size={1}></Icon>
                                UBX
                            </button>

                            <button
                                className="mapButton"
                                onClick={() => {
                                    this.toggleMeasureResult();
                                }}
                            >
                                <Icon path={mdiRuler} size={1}></Icon>
                            </button>

                            <button
                                id="clearMapButton"
                                className="mapButton"
                                onClick={() => {
                                    this.map.clear();
                                }}
                            >
                                <Icon path={mdiTrashCan} size={1}></Icon>
                            </button>
                        </div>

                        <div
                            id="layerSwitcher"
                            style={{
                                display: this.state.layerSwitcherVisible ? "inline-block" : "none",
                            }}
                        ></div>

                        <div
                            id="measureResult"
                            className={this.state.measureResultVisible ? "" : "notVisible"}
                        >
                            <div id="measureMagnitude">{this.state.measureMagnitude}</div>
                            <div id="measureUnit">{this.state.measureUnit}</div>
                        </div>
                    </div>
                </div>

                <TimeSlider
                    t={this.state.t}
                    tMin={this.state.tMin}
                    tMax={this.state.tMax}
                    onValueChanged={(t) => {
                        this.setState({ t: t });
                    }}
                ></TimeSlider>

                {log_selector}

                {busyOverlay}

                {this.state.customAlert}
            </div>
        );
    }

    ubxDownloadButtonPressed() {
        this.startBusyIndicator();

        LogApi.getUBX(this.state.chosenLogs)
            .catch((err) => {
                CustomAlert.presentAlert({ text: `Failed to download UBX file.\n${err}` });
            })
            .finally(() => {
                this.stopBusyIndicator();
            });
    }

    chosenLogsListElement() {
        const chosenLogsElements = this.state.chosenLogs.map((chosenLogPath) => {
            const chosenLogName = chosenLogPath.split("/").at(-1);
            const href = `/jdv/h5?file=${chosenLogPath}`;

            const logs_are_displayed = this.state.chosenLogs.length > 0;

            // Check that we're retrieving the metadata ONLY for the log file associated with the info button we clicked
            const information_dialog =
                this.state.isInformationDialogVisible &&
                chosenLogName === this.state.chosenLogName ? (
                    <InformationDialog
                        logFileName={this.state.chosenLogName}
                        onClose={() => this.setState({ isInformationDialogVisible: false })}
                    />
                ) : null;

            return (
                <div
                    key={chosenLogName}
                    className="logHeaderRow rounded shadowed padded"
                    id="logListRow"
                    style={{ margin: "4pt" }}
                >
                    <a href={href}>{chosenLogName}</a>
                    <Button
                        className="plotButton"
                        variant="text"
                        style={{
                            display: logs_are_displayed ? "flex" : "none",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            marginLeft: "4pt",
                            verticalAlign: "middle",
                        }}
                        onClick={() => {
                            this.setState({
                                chosenLogName: chosenLogName,
                                isInformationDialogVisible: !this.state.isInformationDialogVisible,
                            });
                        }}
                    >
                        <Icon path={mdiInformation} size={0.75}></Icon>
                    </Button>

                    {information_dialog}
                </div>
            );
        });

        return (
            <div id="logList" className="padded">
                {chosenLogsElements}
            </div>
        );
    }

    togglerLayerSwitcher() {
        this.setState({ layerSwitcherVisible: !this.state.layerSwitcherVisible });
    }

    toggleMeasureResult() {
        const olMap = this.map.getMap();
        const measureInteraction = createMeasureInteraction(
            olMap,
            this.setMeasureResultValue.bind(this),
        );

        if (!this.state.measureResultVisible) {
            olMap.addInteraction(measureInteraction);
            document.getElementById("mapPane").style.cursor = "crosshair";
        } else {
            const mapInteractions = olMap.getInteractions().getArray();

            for (const mapInteraction of mapInteractions) {
                if (mapInteraction instanceof Draw) {
                    olMap.removeInteraction(mapInteraction);
                    this.setMeasureResultValue("", "");
                }
            }
            document.getElementById("mapPane").style.cursor = "default";
        }

        this.setState({ measureResultVisible: !this.state.measureResultVisible });
    }

    setMeasureResultValue(magnitude: string, unit: string) {
        this.setState({
            measureMagnitude: magnitude,
            measureUnit: unit,
        });
    }

    selectLogButtonPressed(evt: Event) {
        this.setState({ isSelectingLogs: true });
    }

    componentDidUpdate(prevProps: AppProps, prevState: State) {
        if (this.state.chosenLogs !== prevState.chosenLogs) {
            if (this.state.chosenLogs.length > 0) {
                // Get map data
                const getMapJob = LogApi.getMapData(this.state.chosenLogs).then(
                    (botIdToMapSeries) => {
                        this.map.setMapDict(botIdToMapSeries);
                        this.setState({
                            tMin: this.map.tMin,
                            tMax: this.map.tMax,
                            t: this.map.timestamp,
                        });
                    },
                );
                // Get the command dictionary (botId => [Command])
                const getCommandsJob = LogApi.getCommands(this.state.chosenLogs).then(
                    (command_dict) => {
                        this.map.updateWithCommands(command_dict);
                    },
                );

                // Get the active_goals
                const getActiveGoalsJob = LogApi.getActiveGoal(this.state.chosenLogs).then(
                    (active_goal_dict) => {
                        this.map.updateWithActiveGoal(active_goal_dict);
                    },
                );

                // Get the task packets
                const getTaskPacketsJob = LogApi.getTaskPackets(this.state.chosenLogs).then(
                    (task_packets) => {
                        this.map.updateWithTaskPackets(task_packets);
                    },
                );

                // Get the depth contours
                const getDepthContoursJob = LogApi.getDepthContours(this.state.chosenLogs).then(
                    (geoJSON) => {
                        this.map.updateWithDepthContourGeoJSON(geoJSON);
                    },
                );

                // Get the drift interpolations
                const getDriftInterpolationsJob = LogApi.getDriftInterpolations(
                    this.state.chosenLogs,
                ).then((geoJSON) => {
                    this.map.updateWithDriftInterpolationGeoJSON(geoJSON);
                });

                // Get the series descriptors
                const getSeriesDescriptorsJob = LogApi.getAllSeriesDescriptors(
                    this.state.chosenLogs,
                ).then((seriesDescriptors) => {
                    this.seriesDescriptors = seriesDescriptors;
                });

                this.startBusyIndicator();
                Promise.all([
                    getMapJob,
                    getCommandsJob,
                    getActiveGoalsJob,
                    getTaskPacketsJob,
                    getDepthContoursJob,
                    getDriftInterpolationsJob,
                    getSeriesDescriptorsJob,
                ])
                    .catch(exceptionCatcher)
                    .finally(() => {
                        this.stopBusyIndicator();
                    });
            } else {
                this.map.clear();
            }
        }

        if (this.state.visibleTimeRange !== prevState.visibleTimeRange) {
            this.map.setTimeRange(this.state.visibleTimeRange);
        }

        if (this.state.t !== prevState.t) {
            this.map.updateToTimestamp(this.state.t);
        }
    }

    componentDidMount() {
        this.getElements();
        this.map = new JaiaMap("openlayers-map");
    }

    getElements() {
        // Get global element names for the functions that are still using them
        this.plot_div_element = document.getElementById("plot") as Plotly.PlotlyHTMLElement;
    }

    didSelectLogs(logFilenames?: string[]) {
        this.setState({ isSelectingLogs: false });
        if (logFilenames == null) return;

        const self = this;

        function openLogsWhenReady() {
            self.startBusyIndicator();

            LogApi.postConvertIfNeeded(logFilenames)
                .then((response) => {
                    if (response.done) {
                        self.stopBusyIndicator();
                        self.setState({ chosenLogs: logFilenames, plots: [] });
                    } else {
                        console.log(`Waiting on conversion of ${logFilenames}`);
                        setTimeout(openLogsWhenReady, 1000);
                    }
                })
                .catch((err) => {
                    CustomAlert.presentAlert({ text: err });
                    self.stopBusyIndicator();
                });
        }

        openLogsWhenReady();
    }

    startBusyIndicator() {
        this.setState({ isBusy: true });
    }

    stopBusyIndicator() {
        this.setState({ isBusy: false });
    }

    /**
     * Load the selected paths and update the interface.
     *
     * @param {string[]} pathArray An array of paths that the user selected.
     */
    setPaths(pathArray: string[]) {
        console.debug(`Selected paths: ${pathArray}`);

        this.startBusyIndicator();

        LogApi.getSeries(this.state.chosenLogs, pathArray)
            .then((series) => {
                if (series != null) {
                    let plots = this.state.plots;
                    this.setState({ plots: plots.concat(series) });
                }
            })
            .catch((err) => {
                alert(`Failed to load series.\n${err}`);
            })
            .finally(() => {
                this.stopBusyIndicator();
            });
    }

    setPlots(plots: Plot[]) {
        this.setState({ plots });
    }

    setVisibleTimeRange(timeRange?: number[]) {
        this.setState({ visibleTimeRange: timeRange ?? [0, Number.MAX_SAFE_INTEGER] });
    }

    setTime(t: number | null) {
        this.setState({ t });
    }

    moosMessagesButton() {
        return (
            <button
                className="padded"
                disabled={this.state.chosenLogs.length == 0}
                onClick={() => {
                    this.open_moos_messages(this.state.visibleTimeRange);
                }}
            >
                Download MOOS Messages...
            </button>
        );
    }

    open_moos_messages(time_range: number[]) {
        LogApi.getMOOS(this.state.chosenLogs, time_range);
    }
}
