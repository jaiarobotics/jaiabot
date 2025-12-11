export interface Plot {
    title: string;
    y_axis_title: string;
    _utime_: number[];
    series_y: number[];
    hovertext_map?: { [key: number]: string };
    hovertext?: string[];
    path: string;
    downsampled_plot?: Plot;
}

export function Plot_get_hovertext(plot: Plot) {
    if (plot.hovertext) {
        return plot.hovertext;
    } else if (plot.hovertext_map) {
        return plot.series_y.map((y_value) => plot.hovertext_map[y_value] ?? String(y_value));
    } else return null;
}

export function Plot_get_hovertext_by_index(plot: Plot, index: number) {
    if (plot.hovertext) {
        return plot.hovertext[index] ?? null;
    } else if (plot.hovertext_map) {
        const y_value = plot.series_y[index];
        return plot.hovertext_map[y_value] ?? String(y_value);
    } else return null;
}

export function Plot_generate_downsampled_plots(plot: Plot, max_points: number) {
    if (plot.downsampled_plot) {
        // Already downsampled
        return;
    }

    if (plot._utime_.length <= max_points) {
        // No need to downsample
        return;
    }

    let new_plot: Plot = {
        title: plot.title,
        y_axis_title: plot.y_axis_title,
        _utime_: [] as number[],
        series_y: [] as number[],
        hovertext_map: plot.hovertext_map,
        path: plot.path,
    };

    if (plot.hovertext) {
        new_plot.hovertext = [];
    }

    // Downsample
    const N = plot._utime_.length;
    let last_y = 0;
    for (let i = 0; i < N; i += 2) {
        let best_index: number = null;
        let largest_abs_delta = 0;

        // Find the point with the largest delta in this segment
        for (let j = i; j < i + 2; j++) {
            let abs_delta = Math.abs(plot.series_y[j] - last_y);
            if (best_index === null || abs_delta > largest_abs_delta) {
                best_index = j;
                largest_abs_delta = abs_delta;
            }
        }

        // Add the best point to the new plot
        new_plot._utime_.push(plot._utime_[best_index]);
        new_plot.series_y.push(plot.series_y[best_index]);

        if (plot.hovertext) {
            new_plot.hovertext.push(plot.hovertext[best_index]);
        }

        // This is the last y for the next segment
        last_y = plot.series_y[best_index];
    }

    console.debug(`Downsampled plot ${plot.title} from ${N} to ${new_plot._utime_.length} points`);

    // Recursively downsample until we are under the max points
    Plot_generate_downsampled_plots(new_plot, max_points);
    plot.downsampled_plot = new_plot;
}

export function Plot_get_plot_to_use(
    plot: Plot,
    visible_duration: number,
    max_points: number,
): Plot {
    const total_duration = plot._utime_[plot._utime_.length - 1] - plot._utime_[0];
    const actual_visible_duration = Math.min(visible_duration, total_duration); // Avoid division by zero
    const esimated_points_in_view =
        (actual_visible_duration / total_duration) * plot._utime_.length;

    console.debug(
        `Plot ${plot.title} has total duration ${total_duration}s, visible duration ${actual_visible_duration}s, estimated points in view ${esimated_points_in_view}, max points ${max_points}`,
    );

    if (esimated_points_in_view > max_points) {
        // Use downsampled plot
        if (plot.downsampled_plot) {
            return Plot_get_plot_to_use(plot.downsampled_plot, visible_duration, max_points);
        } else {
            console.warn(
                `Plot ${plot.title} needs downsampling but no downsampled plot is available`,
            );
            return plot;
        }
    } else {
        // Use full resolution plot
        return plot;
    }
}
