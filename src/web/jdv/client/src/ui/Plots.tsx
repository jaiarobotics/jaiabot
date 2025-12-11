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
import { ISODateToMicros, microsToDate } from "../tools/date";
import {
    Plot,
    Plot_generate_downsampled_plots,
    Plot_get_hovertext_by_range,
    Plot_get_plot_to_use,
} from "../model/Plot";
import { PlotProfiles } from "../model/PlotProfiles";

import PathSelector from "./PathSelector";
import { OpenPlotSet } from "./OpenPlotSet";
import { DataTable } from "./DataTable";
import { CustomAlert } from "../shared/CustomAlert";

import { Switch } from "@mui/material";

import "./Plots.css";

export interface PlotsDelegate {
    setPlots: (plots: Plot[]) => void;
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
            props.delegate.setVisibleTimeRange(null);
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
                type: "scattergl",
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

            plot_div_element.on("plotly_click", function (data) {
                let pointIndex = data.points[0].pointIndex;
                let timestamp_utime = Number(data.points[0].data.customdata[pointIndex]);
                props.delegate.setTime(timestamp_utime);
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
        console.debug("Refreshing plot data");

        const { plots, visibleTimeRange } = props;

        if (plots.length == 0) return;

        const MAX_DATA_POINTS = 400;

        let update: any = {
            x: [],
            y: [],
            hovertext: [],
            mode: [],
            customdata: [],
        };

        const getIndexRange = (series: Plot, t_start: number, t_end: number) => {
            const start_index = bisect(series._utime_, (t) => t_start - t)?.index ?? 0;
            const end_index =
                bisect(series._utime_, (t) => t_end - t)?.index ?? series._utime_.length;
            return [start_index, Math.min(end_index + 2, series._utime_.length)];
        };

        for (let [plot_index, series] of plots.entries()) {
            const visible_duration = visibleTimeRange
                ? visibleTimeRange[1] - visibleTimeRange[0]
                : series._utime_[series._utime_.length - 1] - series._utime_[0];

            Plot_generate_downsampled_plots(series, MAX_DATA_POINTS);
            const plot_to_use = Plot_get_plot_to_use(series, visible_duration, MAX_DATA_POINTS);

            // Use lines+markers for the full series, to indicate full resolution
            const auto_mode = plot_to_use == series ? "lines+markers" : "lines";

            const [start_index, end_index] = getIndexRange(
                plot_to_use,
                visibleTimeRange ? visibleTimeRange[0] : Number.MIN_SAFE_INTEGER,
                visibleTimeRange ? visibleTimeRange[1] : Number.MAX_SAFE_INTEGER,
            );

            // Add margin of 100% on each side if not at the edges
            const total_points = plot_to_use._utime_.length;
            const index_range = end_index - start_index;
            const margin = index_range; // 100% margin

            const adjusted_start_index = Math.max(0, start_index - margin);
            const adjusted_end_index = Math.min(total_points, end_index + margin);

            const utime = plot_to_use._utime_.slice(adjusted_start_index, adjusted_end_index);
            const x_values = utime.map((t) => microsToDate(t));
            const y_values = plot_to_use.series_y.slice(adjusted_start_index, adjusted_end_index);
            const customdata = plot_to_use._utime_.slice(adjusted_start_index, adjusted_end_index);
            const hovertext = Plot_get_hovertext_by_range(
                plot_to_use,
                adjusted_start_index,
                adjusted_end_index,
            );

            update.x.push(x_values);
            update.y.push(y_values);
            update.hovertext.push(hovertext);
            update.customdata.push(customdata);
            update.mode.push(auto_mode);
        }
        Plotly.restyle("plot", update);
    };

    useEffect(refreshPlotData, [props.chosenLogs, props.plots, props.visibleTimeRange]);

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
