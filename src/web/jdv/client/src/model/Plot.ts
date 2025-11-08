export interface Plot {
    title: string;
    y_axis_title: string;
    _utime_: number[];
    series_y: number[];
    hovertext: { [key: number]: string };
    path: string;
}

export function Plot_get_hovertext(plot: Plot) {
    if (!plot.hovertext) {
        return null;
    }

    return plot.series_y.map((y_value) => plot.hovertext[y_value] ?? y_value);
}
