import React from "react";
import { Plot } from "../model/Plot";
import { bisect } from "../tools/bisect";
import "./DataTable.css";

type PlotList = Plot[];

export interface DataTableProps {
    plots: PlotList;
    timestamp_micros: number;
}

export function DataTable(props: DataTableProps) {
    if (props.plots.length == 0) return null;

    const headerRow = (
        <thead>
            <tr>
                <th>Key</th>
                <th>Value</th>
            </tr>
        </thead>
    );

    const dataRows = (
        <tbody>
            {props.plots.map((plot, plotIndex) => {
                const index = bisect(plot._utime_, (_utime_) => {
                    return props.timestamp_micros - _utime_;
                })?.index;

                const value = plot.series_y[index];
                const enumDescription = plot.hovertext_map?.[value];

                var valueString = "";
                if (enumDescription != null) {
                    valueString = `${enumDescription} (${value})`;
                } else {
                    valueString = value?.toPrecision(6) ?? "-";
                }

                return (
                    <tr key={plot.title + plotIndex}>
                        <td className="dataKey">{plot.title}</td>
                        <td>{valueString}</td>
                    </tr>
                );
            })}
        </tbody>
    );

    return (
        <div className="dataTable shadowed rounded padded">
            <table>
                {headerRow}
                {dataRows}
            </table>
        </div>
    );
}
