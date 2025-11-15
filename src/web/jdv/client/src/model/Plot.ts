export interface Plot {
    title: string;
    y_axis_title: string;
    _utime_: number[];
    series_y: number[];
    hovertext_map: { [key: number]: string };
    path: string;
}

export function Plot_get_hovertext(plot: Plot) {
    if (!plot.hovertext_map) {
        return null;
    }

    return plot.series_y.map((y_value) => plot.hovertext_map[y_value] ?? y_value);
}
