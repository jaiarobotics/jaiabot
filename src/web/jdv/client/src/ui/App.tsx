import { mdiDownload, mdiUpload, mdiTrashCan, mdiRuler } from "@mdi/js";
import Icon from "@mdi/react";
import React from "react";

import JaiaMap from "./JaiaMap";
import LogSelector from "./LogSelector";
import TimeSlider from "./TimeSlider";
import { Plots } from "./Plots";

import { createMeasureInteraction } from "../tools/interactions";
import { LogApi } from "../model/LogApi";
import { Plot } from "../model/Plot";
import { Draw } from "ol/interaction";

import "../styles/styles.css";
import { CustomAlert, CustomAlertProps } from "../shared/CustomAlert";

import { bisect } from "../tools/bisect";

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

/**
 * Convert from an ISO date string to UNIX timestamp in microseconds.
 *
 * @param {string} iso_date_string The date string to convert, in ISO date format.
 * @returns {number} The UNIX timestamp in microseconds, or `null` if the conversion could not be made.
 */
function ISODateToMicros(iso_date_string: string) {
    const millis = Date.parse(iso_date_string);
    return isNaN(millis) ? null : millis * 1e3;
}

interface AppProps {}

interface State {
    isSelectingLogs: boolean;
    chosenLogs: string[];
    plots: Plot[];
    layerSwitcherVisible: boolean;
    measureResultVisible: boolean;
    measureMagnitude: string;
    measureUnit: string;
    timeFraction: number | null;
    t: number | null; // Currently selected time
    tMin: number | null; // Minimum time for these logs
    tMax: number | null; // Maximum time for these logs
    plotMode: string | null; // Mode for lines and/or markers (null means automatic depending on zoom level)

    // Modal busy indicator
    isBusy: boolean;

    // Custom Alert shown, if any
    customAlert?: React.JSX.Element;
}

export class App extends React.Component {
    state: State;
    map: JaiaMap;
    plot_div_element: any;
    _visible_time_range: number[];

    constructor(props: AppProps) {
        super(props);

        this.state = {
            isSelectingLogs: false,
            chosenLogs: [],
            plots: [],
            plotMode: null,
            layerSwitcherVisible: false,
            measureResultVisible: false,
            measureMagnitude: "",
            measureUnit: "",
            timeFraction: null,
            t: null, // Currently selected time
            tMin: null, // Minimum time for these logs
            tMax: null, // Maximum time for these logs
            isBusy: false,
            customAlert: null,
        };

        this._visible_time_range = [0, 2 ** 60]; // Include every data point

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

        return (
            <div className="vertical flexbox maximized">
                <div className="vertical flexbox top_pane padded">
                    <div className="row">
                        <img src="/favicon.png" className="jaia-icon" />
                        <h2 className="appName">{APP_NAME}</h2>
                    </div>
                </div>

                <div>
                    <button className="padded" onClick={self.selectLogButtonPressed.bind(self)}>
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
                        visibleTimeRange={this._visible_time_range}
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
                        this.map.updateToTimestamp(t);
                        this.setState({ t: t });
                    }}
                ></TimeSlider>

                {log_selector}
                {busyOverlay}

                {this.state.customAlert}
            </div>
        );
    }

    chosenLogsListElement() {
        const chosenLogsElements = this.state.chosenLogs.map((chosenLogPath) => {
            const chosenLogName = chosenLogPath.split("/").at(-1);
            const href = `/h5?file=${chosenLogPath}`;
            return (
                <a href={href} key={chosenLogName} style={{ padding: "10pt" }}>
                    {chosenLogName}
                </a>
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

                this.startBusyIndicator();
                Promise.all([
                    getMapJob,
                    getCommandsJob,
                    getActiveGoalsJob,
                    getTaskPacketsJob,
                    getDepthContoursJob,
                    getDriftInterpolationsJob,
                ])
                    .catch(exceptionCatcher)
                    .finally(() => {
                        this.stopBusyIndicator();
                    });
            } else {
                this.map.clear();
            }
        }

        if (
            this.state.chosenLogs !== prevState.chosenLogs ||
            this.state.plots !== prevState.plots
        ) {
            this.refreshPlots();
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

        this.setState({ isPathSelectorDisplayed: false });
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

    setPlotMode(plotMode: string | null) {
        this.setState({ plotMode }, () => {
            this._refreshPlotData();
        });
    }

    _refreshPlotData() {
        if (this.state.plots.length == 0) return;

        const MAX_DATA_POINTS = 400;

        let update: any = {
            x: [],
            y: [],
            hovertext: [],
            mode: [],
            customdata: [],
        };

        for (let [plot_index, series] of this.state.plots.entries()) {
            // Plotly optimization:  only use the data within the plot time range, and only use a maximum number of data points.
            // This greatly improves GUI responsiveness.
            const start_data_index =
                bisect(series._utime_, (t) => this._visible_time_range[0] - t)?.index ?? 0;
            const end_data_index =
                (bisect(series._utime_, (t) => this._visible_time_range[1] - t)?.index ??
                    series._utime_.length - 1) + 1;
            const data_index_step = Math.max(
                1,
                (end_data_index - start_data_index) / MAX_DATA_POINTS,
            );

            let x_values = [];
            let customdata = [];
            let y_values = [];
            for (
                let data_index = start_data_index;
                data_index <= end_data_index;
                data_index += data_index_step
            ) {
                const data_index_int = Math.round(data_index);
                customdata.push(series._utime_[data_index_int]);
                x_values.push(new Date(series._utime_[data_index_int] / 1e3));
                y_values.push(series.series_y[data_index_int]);
            }

            let hovertext = y_values.map((y) => series.hovertext?.[y]);
            const auto_mode = data_index_step > 1 ? "lines" : "lines+markers"; // Use lines and markers to indicate that we've got full resolution

            update.x.push(x_values);
            update.y.push(y_values);
            update.hovertext.push(hovertext);
            update.customdata.push(customdata);
            update.mode.push(this.state.plotMode == "auto" ? auto_mode : this.state.plotMode);
        }
        Plotly.restyle("plot", update);
    }

    setVisibleTimeRange(timeRange?: number[]) {
        this._visible_time_range = timeRange ?? [0, Number.MAX_SAFE_INTEGER];
        this.map.setTimeRange(this._visible_time_range);
        this._refreshPlotData();
    }

    refreshPlots() {
        const plot_time_range = this._visible_time_range;

        if (this.state.plots.length == 0) {
            Plotly.purge(this.plot_div_element);
            return;
        }

        var data: Plotly.Data[] = [];
        var layout: any = { showlegend: false };

        for (let [plot_index, series] of this.state.plots.entries()) {
            // Set the y-axis for this plot
            function wrapLines(text: string, maxLength = 30, splitChars = ["/", " "]) {
                // Get components that include the splitChars
                var components: string[] = [];
                var newComponent = true;

                for (let characterIndex = 0; characterIndex < text.length; characterIndex++) {
                    if (newComponent) {
                        components.push("");
                    }

                    const c = text[characterIndex];
                    components[components.length - 1] = components[components.length - 1].concat(c);

                    if (splitChars.includes(c)) {
                        newComponent = true;
                    } else {
                        newComponent = false;
                    }
                }

                // Concat the components, with <br> if necessary
                var lines: string[] = [];
                var line = "";

                for (const component of components) {
                    if (component.length > maxLength) {
                        if (line.length > 0) {
                            lines.push(line);
                        }
                        lines.push(component);
                        continue;
                    }

                    if (line.length + component.length > maxLength) {
                        lines.push(line);
                        line = component;
                        continue;
                    }

                    line = line.concat(component);
                }

                if (line.length > 0) {
                    lines.push(line);
                }

                return lines.join("<br>");
            }

            const y_axis_title = wrapLines(series.y_axis_title.replaceAll("\n", "<br>"));
            layout["yaxis" + (plot_index + 1)] = { title: y_axis_title };

            // Add to the data array
            let yaxis = "y" + (plot_index + 1);

            let trace: Plotly.Data = {
                name: series.title,
                x: [new Date()],
                y: [0.0],
                xaxis: "x",
                yaxis: yaxis,
                hovertext: [],
                type: "scatter",
                mode: "lines+markers",
            };

            data.push(trace);
        }

        layout.grid = { rows: data.length, columns: 1, pattern: "coupled" };

        layout.height = data.length * 300 + 1; // in pixels

        // Preserve current x axis range
        const current_layout_xaxis = this.plot_div_element.layout?.xaxis;
        if (current_layout_xaxis != null) {
            layout.xaxis = current_layout_xaxis;
        }

        Plotly.newPlot(this.plot_div_element, data, layout).then(() => {
            this._refreshPlotData();

            const onHoverOrClickEvent = (data: Plotly.PlotHoverEvent | Plotly.PlotMouseEvent) => {
                let pointIndex = data.points[0].pointIndex;
                let timestamp_utime = Number(data.points[0].data.customdata[pointIndex]);
                this.map.updateToTimestamp(timestamp_utime);
                this.setState({ t: timestamp_utime });
            };

            this.plot_div_element.on("plotly_hover", onHoverOrClickEvent);
            this.plot_div_element.on("plotly_click", onHoverOrClickEvent);

            const onUnhoverEvent = (data: Plotly.PlotHoverEvent) => {
                this.map.updateToTimestamp(null);
            };

            this.plot_div_element.on("plotly_unhover", onUnhoverEvent);

            // Zooming into plots
            this.plot_div_element.on("plotly_relayout", (eventdata: Plotly.PlotRelayoutEvent) => {
                // When autorange, zoom out to the whole set of points
                if (eventdata["xaxis.autorange"]) {
                    this.setVisibleTimeRange(null);
                    return;
                }

                const t0 = ISODateToMicros(String(eventdata["xaxis.range[0]"])) ?? 0;
                const t1 =
                    ISODateToMicros(String(eventdata["xaxis.range[1]"])) ?? Number.MAX_SAFE_INTEGER;

                this.setVisibleTimeRange([t0, t1]);
            });
        });
    }

    moosMessagesButton() {
        return (
            <button
                className="padded"
                disabled={this.state.chosenLogs.length == 0}
                onClick={() => {
                    this.open_moos_messages(this._visible_time_range);
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
