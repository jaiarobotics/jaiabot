import React from "react";
import { Plot } from "./Plot";
import { bisect } from "./bisect";

type PlotList = Plot[];

export function DataTable(plots: PlotList, timestamp_micros: number) {
    if (plots.length == 0) return null;

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
            {plots.map((plot, plotIndex) => {
                const index = bisect(plot._utime_, (_utime_) => {
                    return timestamp_micros - _utime_;
                })?.index;

                const value = plot.series_y[index];
                const enumDescription = plot.hovertext?.[value];

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
        <div className="dataTable">
            <table>
                {headerRow}
                {dataRows}
            </table>
        </div>
    );
}
