export interface Plot {
    title: string;
    y_axis_title: string;
    _utime_: number[];
    series_y: number[];
    hovertext: { [key: number]: string };
    path: string;
}

export function Plot_get_hovertext(
    y: number[],
    hovertext_map: { [key: number]: string },
): (string | number)[] {
    if (!hovertext_map) {
        return null;
    }

    return y.map((y_value) => hovertext_map[y_value] ?? y_value);
}
