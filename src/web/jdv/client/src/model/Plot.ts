export interface Plot {
    title: string;
    y_axis_title: string;
    _utime_: number[];
    series_y: number[];
    hovertext_map?: { [key: number]: string };
    hovertext?: string[];
    path: string;
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
