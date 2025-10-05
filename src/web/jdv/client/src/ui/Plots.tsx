import React, { MouseEventHandler, useEffect } from "react";

import {
    mdiPlus,
    mdiFolderOpen,
    mdiContentSave,
    mdiDownload,
    mdiTrashCan,
    mdiClose,
} from "@mdi/js";
import Icon from "@mdi/react";

const Plotly = require("plotly.js-dist");

import { downloadCSV } from "../tools/DownloadCSV";
import { bisect } from "../tools/bisect";
import { ISODateToMicros } from "../tools/date";
import { Plot } from "../model/Plot";
import { PlotProfiles } from "../model/PlotProfiles";

import PathSelector from "./PathSelector";
import { OpenPlotSet } from "./OpenPlotSet";
import { DataTable } from "./DataTable";
import { CustomAlert } from "../shared/CustomAlert";

import "./Plots.css";

export interface PlotsDelegate {
    setPlots: (plots: Plot[]) => void;
    setPlotMode: (plotMode: string | null) => void;
    setPaths: (paths: string[]) => void;
    setTime: (t_micros: number | null) => void;
    setVisibleTimeRange: (timeRange: number[] | null) => void;
}

export interface PlotsProps {
    chosenLogs: string[];
    delegate: PlotsDelegate;
    plots: Plot[];
    t: number;
    visibleTimeRange: number[];
    plotMode: string | null;
}

export function Plots(props: PlotsProps) {
    const [isPathSelectorDisplayed, setIsPathSelectorDisplayed] = React.useState(false);
    const [isOpenPlotSetDisplayed, setIsOpenPlotSetDisplayed] = React.useState(false);

    function deletePlotClicked(plotIndex: number) {
        let { plots } = props;
        let newPlots = plots.filter((value, index) => {
            return index != plotIndex;
        });

        props.delegate.setPlots(newPlots);
    }

    async function savePlotSetClicked() {
        const plotSetName = prompt("Please name this plot set");

        if (plotSetName == null) {
            // User clicked Cancel
            return;
        }

        if (PlotProfiles.exists(plotSetName)) {
            if (
                !(await CustomAlert.confirmAsync(
                    `Are you sure you want to overwrite plot set named \"${plotSetName}?`,
                    "Overwrite Plot Set",
                ))
            )
                return;
        }

        let pathNames = props.plots.map((series) => series.path);
        PlotProfiles.save_profile(plotSetName, pathNames);
    }

    const createPlots = () => {
        const { visibleTimeRange, plots } = props;
        const plot_div_element = document.getElementById("plot") as Plotly.PlotlyHTMLElement;
        const plot_time_range = visibleTimeRange;

        if (plots.length == 0) {
            Plotly.purge(plot_div_element);
            return;
        }

        var data: Plotly.Data[] = [];
        var layout: any = { showlegend: false };

        for (let [plot_index, series] of plots.entries()) {
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
        const current_layout_xaxis = plot_div_element.layout?.xaxis;
        if (current_layout_xaxis != null) {
            layout.xaxis = current_layout_xaxis;
        }

        Plotly.newPlot(plot_div_element, data, layout).then(() => {
            refreshPlotData();

            // Setup the triggers
            plot_div_element.on("plotly_hover", function (data: Plotly.PlotHoverEvent) {
                let pointIndex = data.points[0].pointIndex;
                let timestamp_utime = Number(data.points[0].data.customdata[pointIndex]);
                props.delegate.setTime(timestamp_utime);
            });

            plot_div_element.on("plotly_unhover", function (data: Plotly.PlotHoverEvent) {
                props.delegate.setTime(null);
            });

            // Zooming into plots
            plot_div_element.on("plotly_relayout", function (eventdata: Plotly.PlotRelayoutEvent) {
                // When autorange, zoom out to the whole set of points
                if (eventdata["xaxis.autorange"]) {
                    props.delegate.setVisibleTimeRange(null);
                    return;
                }

                const t0 = ISODateToMicros(String(eventdata["xaxis.range[0]"])) ?? 0;
                const t1 =
                    ISODateToMicros(String(eventdata["xaxis.range[1]"])) ?? Number.MAX_SAFE_INTEGER;

                props.delegate.setVisibleTimeRange([t0, t1]);
            });
        });
    };

    useEffect(createPlots, [props.chosenLogs, props.plots]);

    const refreshPlotData = () => {
        const { plots, visibleTimeRange, plotMode } = props;

        if (plots.length == 0) return;

        const MAX_DATA_POINTS = 400;

        let update: any = {
            x: [],
            y: [],
            hovertext: [],
            mode: [],
            customdata: [],
        };

        for (let [plot_index, series] of plots.entries()) {
            // Plotly optimization:  only use the data within the plot time range, and only use a maximum number of data points.
            // This greatly improves GUI responsiveness.
            const start_data_index =
                bisect(series._utime_, (t) => visibleTimeRange[0] - t)?.index ?? 0;
            const end_data_index =
                bisect(series._utime_, (t) => visibleTimeRange[1] - t)?.index ??
                series._utime_.length;
            const data_index_step = Math.max(
                1,
                (end_data_index - start_data_index) / MAX_DATA_POINTS,
            );

            let x_values = [];
            let customdata = [];
            let y_values = [];
            for (
                let data_index = start_data_index;
                data_index < end_data_index;
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
            update.mode.push(plotMode == "auto" ? auto_mode : plotMode);
        }
        Plotly.restyle("plot", update);
    };

    useEffect(refreshPlotData, [
        props.chosenLogs,
        props.plots,
        props.visibleTimeRange,
        props.plotMode,
    ]);

    var actionBar: JSX.Element | null;

    if (props.chosenLogs.length > 0) {
        actionBar = (
            <div className="plotButtonBar rounded margin padding">
                <button
                    title="Add Plot"
                    className="plotButton"
                    onClick={() => {
                        setIsPathSelectorDisplayed(true);
                    }}
                >
                    <Icon path={mdiPlus} size={1} style={{ verticalAlign: "middle" }}></Icon>
                </button>
                <button
                    title="Load Plot Set"
                    className="plotButton"
                    onClick={() => {
                        setIsOpenPlotSetDisplayed(true);
                    }}
                >
                    <Icon path={mdiFolderOpen} size={1} style={{ verticalAlign: "middle" }}></Icon>
                </button>
                <button title="Save Plot Set" className="plotButton" onClick={savePlotSetClicked}>
                    <Icon path={mdiContentSave} size={1} style={{ verticalAlign: "middle" }}></Icon>
                </button>
                <button
                    title="Download CSV"
                    className="plotButton"
                    disabled={props.plots.length == 0}
                    onClick={() => {
                        downloadCSV(props.plots, props.visibleTimeRange);
                    }}
                >
                    <Icon path={mdiDownload} size={1} style={{ verticalAlign: "middle" }}></Icon>
                    CSV
                </button>
                <button
                    title="Clear Plots"
                    className="plotButton"
                    onClick={() => {
                        props.delegate.setPlots([]);
                    }}
                >
                    <Icon path={mdiTrashCan} size={1} style={{ verticalAlign: "middle" }}></Icon>
                </button>
                <select
                    name="mode"
                    id="modeSelect"
                    onChange={(e) => {
                        props.delegate.setPlotMode(e.target.value);
                    }}
                >
                    <option value="lines">Lines</option>
                    <option value="markers">Markers</option>
                    <option value="lines+markers">Lines & Markers</option>
                    <option value="auto">Auto</option>
                </select>
            </div>
        );
    } else {
        actionBar = null;
    }

    var pathSelector: JSX.Element | null;
    if (isPathSelectorDisplayed) {
        pathSelector = (
            <PathSelector
                logs={props.chosenLogs}
                key={props.chosenLogs.join(",")}
                didSelectPath={(path: string) => {
                    props.delegate.setPaths([path]);
                    setIsPathSelectorDisplayed(false);
                }}
                didCancel={() => {
                    setIsPathSelectorDisplayed(false);
                }}
            />
        );
    } else {
        pathSelector = null;
    }

    let deleteButtons = props.plots.map((plot, plotIndex) => {
        return (
            <button
                title="Clear Plots"
                className="plotButton"
                onClick={() => {
                    deletePlotClicked(plotIndex);
                }}
                key={plotIndex + "-deleteButton"}
            >
                <Icon path={mdiClose} size={1} style={{ verticalAlign: "middle" }}></Icon>
            </button>
        );
    });

    var openPlotSet: JSX.Element | null;

    openPlotSet = isOpenPlotSetDisplayed ? (
        <OpenPlotSet
            didSelectPlotSet={(paths) => {
                props.delegate.setPaths(paths);
            }}
            didClose={() => {
                setIsOpenPlotSetDisplayed(false);
            }}
        />
    ) : null;

    let noSelectedSeriesMessage: React.JSX.Element = null;
    if (props.chosenLogs.length > 0 && props.plots.length == 0) {
        noSelectedSeriesMessage = (
            <div className="no-selected-series-message">
                No data series selected to plot yet.
                <br />
                To plot or export data as CSV, please select one or more series using the{" "}
                <Icon
                    path={mdiPlus}
                    size={1}
                    className="button"
                    style={{ verticalAlign: "middle", backgroundColor: "lightgray" }}
                ></Icon>{" "}
                button above.
            </div>
        );
    }

    return (
        <div className="plotcontainer rounded shadowed margin padding">
            <h2>Plots</h2>
            {actionBar} {pathSelector}
            <div className="horizontal flexbox">
                <div id="plot" key="plot" className="plot">
                    {noSelectedSeriesMessage}
                </div>
                <div className="vertical flexbox deleteButtonSection">{deleteButtons}</div>
            </div>
            <DataTable plots={props.plots} timestamp_micros={props.t} />
            {openPlotSet}
        </div>
    );
}
