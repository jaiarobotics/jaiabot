export interface Plot {
    title: string;
    y_axis_title: string;
    _utime_: number[];
    series_y: (number | null)[];
    hovertext_map?: { [key: number]: string };
    hovertext?: string[];
    path: string;

    // Added later
    is_full_series?: boolean;
    downsampled_plot?: Plot;
    ymin_index?: number;
    ymax_index?: number;
}

/**
 * Returns an array of hovertext strings for the given Plot object.
 *
 * @param {Plot} plot
 * @returns {string[] | null} An array of hovertext strings, or null if no hovertext is available.
 */
export function Plot_get_hovertext(plot: Plot) {
    if (plot.hovertext) {
        return plot.hovertext;
    } else if (plot.hovertext_map) {
        return plot.series_y.map((y_value) => plot.hovertext_map[y_value] ?? String(y_value));
    } else return null;
}

/**
 * Returns the hovertext value for a give Plot at a given index.
 *
 * @param {Plot} plot
 * @param {number} index
 * @returns {string | null} The hovertext string at the given index, or null if no hovertext is available.
 */
export function Plot_get_hovertext_by_index(plot: Plot, index: number) {
    if (plot.hovertext) {
        return plot.hovertext[index] ?? null;
    } else if (plot.hovertext_map) {
        const y_value = plot.series_y[index];
        return plot.hovertext_map[y_value] ?? String(y_value);
    } else return null;
}

/**
 * Returns an array of hovertext values for a subrange of a Plot object's data.
 *
 * @param {Plot} plot
 * @param {number} start_index
 * @param {number} end_index
 * @returns {string[] | null} An array of hovertext strings for the specified range, or null if no hovertext is available.
 */
export function Plot_get_hovertext_by_range(plot: Plot, start_index: number, end_index: number) {
    if (plot.hovertext) {
        return plot.hovertext.slice(start_index, end_index);
    } else if (plot.hovertext_map) {
        const y_values = plot.series_y.slice(start_index, end_index);
        return y_values.map((y_value) => plot.hovertext_map[y_value] ?? String(y_value));
    } else return null;
}

/**
 * Recursively generates downsampled Plot objects for a given plot and max_points value.
 * It downsamples the plots by 2x, using an algorithm similar to a min/max bucket downsample,
 * to preserve peaks and valleys at all zoom levels.  The 2x downsampled plot is placed in
 * `plot.downsampled_plot`, and the 2x downsample of that plot is placed in its
 * `plot.downsampled_plot` field, etc., until the last downsampled plot has fewer than
 * `max_points` data points in it.
 *
 * @param {Plot} plot
 * @param {number} max_points The maximum number of data points for the last downsampled Plot object.
 */
export function Plot_generate_downsampled_plots(
    plot: Plot,
    max_points: number,
    is_full_series: boolean = true,
): void {
    if (plot.downsampled_plot) {
        // Already downsampled
        return;
    }

    if (plot._utime_.length <= max_points) {
        // No need to downsample
        return;
    }

    plot.is_full_series = is_full_series;

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
        let best_index: number = i;
        let largest_abs_delta = 0;

        // Find the point with the largest delta in this segment
        for (let j = i; j < i + 2; j++) {
            let y = plot.series_y[j];
            if (y === null) continue;

            let abs_delta = Math.abs(y - last_y);
            if (abs_delta > largest_abs_delta) {
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
    Plot_generate_downsampled_plots(new_plot, max_points, (is_full_series = false));
    plot.downsampled_plot = new_plot;
}

/**
 * Return the appropriate Plot object to use for a given visible_duration in time units
 * (microseconds), such that the resulting time window probably has fewer than max_points data points.
 * If the series has a very irregular sampling rate, this is only an estimate.
 *
 * @param {Plot} plot The Plot object to evaluate.
 * @param {number} visible_duration Duration of the visible time window in microseconds.
 * @param {number} max_points Maximum allowed data points in the visible time window.
 * @returns {Plot} The Plot object to use (either the original or a downsampled version).
 */
export function Plot_get_plot_to_use(
    plot: Plot,
    visible_duration: number,
    max_points: number,
): Plot {
    if (!plot._utime_ || plot._utime_.length === 0) {
        // No data points, return the plot as is
        return plot;
    }
    const total_duration = plot._utime_[plot._utime_.length - 1] - plot._utime_[0];
    if (total_duration === 0) {
        // Downsampling is not meaningful for single-timestamp data
        return plot;
    }
    const actual_visible_duration = Math.min(visible_duration, total_duration); // Avoid division by zero
    const estimated_points_in_view =
        (actual_visible_duration / total_duration) * plot._utime_.length;

    console.debug(
        `Plot ${plot.title} has total duration ${total_duration}s, visible duration ${actual_visible_duration}s, estimated points in view ${estimated_points_in_view}, max points ${max_points}`,
    );

    if (estimated_points_in_view > max_points) {
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

/**
 * Calculate the indices of the min and max series_y values for a Plot object.
 *
 * @param {Plot} plot
 * @returns {{ ymin_index: number; ymax_index: number }}
 */
export function Plot_calculate_yminmax_indices(plot: Plot) {
    let ymin_index = 0;
    let ymax_index = 0;
    let ymin = Number.MAX_VALUE;
    let ymax = Number.MIN_VALUE;

    plot.series_y.forEach((y, i) => {
        if (y === null) return;
        if (y < ymin) {
            ymin = y;
            ymin_index = i;
        }
        if (y > ymax) {
            ymax = y;
            ymax_index = i;
        }
    });

    plot.ymin_index = ymin_index;
    plot.ymax_index = ymax_index;
}
