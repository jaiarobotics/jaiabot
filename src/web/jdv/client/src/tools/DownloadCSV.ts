import { Plot } from "../model/Plot";

export function downloadCSV(plots: Plot[], tRange: number[]) {
    if (plots.length == 0) {
        console.error("No plots to download");
        return;
    }

    var csvText = "";
    const plotNames = plots.map((plot) => {
        return plot.title;
    });

    // Header row
    csvText = "Time,_utime_," + plotNames.join(",") + "\n";

    // Make sure tRange is within the bounds of all plots
    const plot_min_utime = Math.min(...plots.map((plot) => plot._utime_[0]));
    const plot_max_utime = Math.max(...plots.map((plot) => plot._utime_[plot._utime_.length - 1]));
    tRange[0] = Math.max(tRange[0], plot_min_utime);
    tRange[1] = Math.min(tRange[1], plot_max_utime);

    var t = tRange[0];
    const STEP = 1e6; // microseconds

    // Indices into the series
    var indices = Array(plots.length).fill(0);
    console.log(indices);

    while (t < tRange[1]) {
        t += STEP;
        const timeString = new Date(t / 1e3).toISOString();
        var csvLine = `${timeString},${t}`;

        var done = true; // Finish when none of the series are incrementing their indices
        var nonempty = false;

        for (const [plotIndex, plot] of plots.entries()) {
            var index = indices[plotIndex];

            if (index != plot._utime_.length - 1) {
                done = false;
            }

            while (index < plot._utime_.length - 1 && plot._utime_[index + 1] < t) {
                index++;
            }

            var value = plot._utime_[index] < t ? plot.series_y[index] : null;
            if (value != null) nonempty = true;

            csvLine += `,${value}`;

            indices[plotIndex] = index;
        }

        if (nonempty) {
            csvText += csvLine + "\n";
        }

        if (done) break;
    }

    const blob = new Blob([csvText], { type: "text/csv" });

    var link = window.document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    // Construct filename dynamically and set to link.download
    link.download = "missionData.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
