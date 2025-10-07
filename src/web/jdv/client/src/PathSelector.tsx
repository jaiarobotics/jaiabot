import { mdiArrowLeft, mdiDelete, mdiMagnify } from "@mdi/js";
import React from "react";
import { LogApi, SeriesDescriptor, SeriesDescriptor_matchesString } from "./LogApi";
import Icon from "@mdi/react";

interface KeywordIndexEntry {
    keyword: string;
    score: number;
    series_descriptor: SeriesDescriptor;
}

interface PathSelectorProps {
    logs: string[];
    didCancel: () => void;
    didSelectPath: (path: string) => void;
}

interface PathSelectorState {
    // General state
    logs: string[];
    mode: "search" | "browse";

    // Search state
    series_descriptors: { [path: string]: SeriesDescriptor };
    series_descriptor_keyword_index: KeywordIndexEntry[];
    search_text: string;
    search_results: SeriesDescriptor[];

    // Path browser state
    chosen_path: string;
    next_path_segments: string[];
}

function get_recent_series_descriptors(): SeriesDescriptor[] {
    const recent_series = localStorage.getItem("recent_series");
    if (recent_series == null) {
        return [];
    }

    try {
        const recent_series_list: SeriesDescriptor[] = JSON.parse(recent_series);
        return recent_series_list;
    } catch (e) {
        console.error("Error parsing recent series from local storage:", e);
        return [];
    }
}

function push_series_to_recents(series_descriptor: SeriesDescriptor) {
    let recent_series = get_recent_series_descriptors();

    // Remove any existing entry for this series
    recent_series = recent_series.filter((sd) => sd.path !== series_descriptor.path);

    // Add to the front
    recent_series.unshift(series_descriptor);

    // Limit to 20 entries
    if (recent_series.length > 20) {
        recent_series = recent_series.slice(0, 20);
    }

    localStorage.setItem("recent_series", JSON.stringify(recent_series));
}

/**
 * A selection dialog for choosing a path from a set of logs.
 *
 */
export default class PathSelector extends React.Component {
    props: PathSelectorProps;
    state: PathSelectorState;

    constructor(props: PathSelectorProps) {
        super(props);

        this.state = {
            logs: props.logs,
            mode: "search",
            chosen_path: "",
            next_path_segments: [],
            series_descriptors: {},
            series_descriptor_keyword_index: [],
            search_text: "",
            search_results: [],
        };
    }

    load_series_descriptors() {
        LogApi.getAllSeriesDescriptors(this.state.logs).then((series_descriptors) => {
            let series_descriptors_map: { [path: string]: SeriesDescriptor } = {};
            for (const sd of series_descriptors) {
                series_descriptors_map[sd.path] = sd;
            }
            this.setState({ series_descriptors: series_descriptors_map });

            var series_descriptor_keyword_index: KeywordIndexEntry[] = [];

            // Pre-calculate keyword scores
            for (const series_descriptor of series_descriptors) {
                let keyword_scores: { [keyword: string]: number } = {};

                for (const name_part of series_descriptor.name.split(" ")) {
                    if (name_part.length > 1) {
                        keyword_scores[name_part.toLowerCase()] =
                            (keyword_scores[name_part.toLowerCase()] || 0) + 3;
                    }
                }

                for (const desc_part of series_descriptor.description?.split(" ") || []) {
                    if (desc_part.length > 1) {
                        keyword_scores[desc_part.toLowerCase()] =
                            (keyword_scores[desc_part.toLowerCase()] || 0) + 2;
                    }
                }

                for (const path_part of series_descriptor.path.split("/")) {
                    if (path_part.length > 1) {
                        keyword_scores[path_part.toLowerCase()] =
                            (keyword_scores[path_part.toLowerCase()] || 0) + 1;
                    }
                }

                for (const [keyword, keyword_score] of Object.entries(keyword_scores)) {
                    series_descriptor_keyword_index.push({
                        keyword: keyword,
                        score: keyword_score,
                        series_descriptor,
                    });
                }
            }

            series_descriptor_keyword_index.sort((a, b) => (b.keyword < a.keyword ? 1 : -1)); // Descending
            this.setState({ series_descriptor_keyword_index });
        });
    }

    componentDidMount() {
        this.load_series_descriptors();
        this.search(""); // Load recents
        this.updatePathOptions(true);
    }

    /**
     * Update search results section to a given query.
     *
     * @param {string} query
     */
    search(query: string) {
        this.setState({ search_text: query });

        // If query string is empty, then default to the recents list
        if (query === "") {
            this.setState({ search_results: get_recent_series_descriptors() });
            return;
        }

        let results: { [path: string]: number } = {};

        for (const query_part of query.toLowerCase().split(" ")) {
            if (query_part.length < 2) {
                continue;
            }

            for (const keyword_entry of this.state.series_descriptor_keyword_index) {
                if (keyword_entry.keyword === query_part) {
                    results[keyword_entry.series_descriptor.path] =
                        (results[keyword_entry.series_descriptor.path] || 0) +
                        2 * keyword_entry.score;
                } else if (keyword_entry.keyword.startsWith(query_part)) {
                    results[keyword_entry.series_descriptor.path] =
                        (results[keyword_entry.series_descriptor.path] || 0) + keyword_entry.score;
                }
            }
        }

        const search_results_paths = Object.keys(results).sort((a, b) => results[b] - results[a]); // Descending
        const search_results = search_results_paths.map(
            (path) => this.state.series_descriptors[path],
        );

        this.setState({ search_results }); // Descending
    }

    renderSearchBar() {
        const doLiveSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
            this.search(e.target.value);
        };

        const doClearSearchBar = (e: React.MouseEvent<HTMLButtonElement>) => {
            this.search("");
        };

        return (
            <div className="section">
                <Icon path={mdiMagnify} size={1} style={{ verticalAlign: "middle" }}></Icon>
                <input
                    className="padded"
                    type="text"
                    placeholder="Search"
                    value={this.state.search_text}
                    onChange={doLiveSearch}
                />
                <button className="padded button" title="Clear" onClick={doClearSearchBar}>
                    ⨉
                </button>
            </div>
        );
    }

    renderSearchResults() {
        function clicked_series(series_descriptor: SeriesDescriptor) {
            push_series_to_recents(series_descriptor);
            this.props.didSelectPath(series_descriptor.path);
        }

        const resultsRows = this.state.search_results.map((series_descriptor, index) => {
            return (
                <div
                    key={index}
                    className="padded listItem vertical flexbox"
                    onClick={clicked_series.bind(this, series_descriptor)}
                >
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.3em" }}>
                        <b>{series_descriptor.name}</b>
                        {series_descriptor.units && (
                            <span
                                style={{ fontSize: "smaller", color: "gray", fontStyle: "italic" }}
                            >
                                {series_descriptor.units}
                            </span>
                        )}
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "0.3em" }}>
                        {series_descriptor.description && (
                            <div style={{ fontSize: "smaller" }}>
                                {series_descriptor.description}
                            </div>
                        )}
                        {series_descriptor.frequency && (
                            <span style={{ fontSize: "smaller", fontStyle: "italic" }}>
                                {series_descriptor.frequency} Hz
                            </span>
                        )}
                    </div>

                    <div style={{ fontSize: "smaller", color: "gray", fontStyle: "italic" }}>
                        {series_descriptor.path}
                    </div>
                </div>
            );
        });

        return (
            <div className="section">
                <div className="list">{resultsRows}</div>
            </div>
        );
    }

    renderSearch() {
        return (
            <div>
                {this.renderSearchBar()}
                {this.renderSearchResults()}
            </div>
        );
    }

    ////////////// Path Browser ///////////////
    updatePathOptions(shouldAutoselect: boolean) {
        // Clear options
        this.setState({ next_path_segments: [] });

        if (this.state.logs == null || this.state.logs.length == 0) {
            return;
        }

        // Get new options
        LogApi.getPaths(this.state.logs, this.state.chosen_path).then((paths) => {
            // This path is a dataset, with no children.  So, get and plot it
            if (paths.length == 0) {
                if (this.state.chosen_path == "") {
                    console.error("No paths returned!");
                    return;
                }

                // Callback
                this.props.didSelectPath?.(this.state.chosen_path);

                // Reset the selector
                this.setState(
                    { chosen_path: "" },
                    this.updatePathOptions.bind(this, shouldAutoselect),
                );

                return;
            }

            // Only one option, so select it and go to the nexxt level
            if (shouldAutoselect && paths.length == 1) {
                let chosen_path = this.state.chosen_path + "/" + paths[0];
                this.setState({ chosen_path }, this.updatePathOptions.bind(this, shouldAutoselect));
                return;
            }

            // More than one option
            this.setState({ next_path_segments: paths });
        });
    }

    didSelectPathSegmentRow(nextPathSegment: string) {
        let chosen_path = this.state.chosen_path + "/" + nextPathSegment;
        this.setState({ chosen_path: chosen_path }, this.updatePathOptions.bind(this, true));
    }

    nextPathSegmentRows() {
        return this.state.next_path_segments.map((nextPathSegment, index) => {
            var className = "padded listItem";
            return (
                <div
                    key={index}
                    className={className}
                    onClick={this.didSelectPathSegmentRow.bind(this, nextPathSegment)}
                >
                    {nextPathSegment}
                </div>
            );
        });
    }

    backClicked() {
        var { chosen_path } = this.state;

        const location = chosen_path.lastIndexOf("/");

        if (location != -1) {
            chosen_path = chosen_path.substring(0, location);
        }

        this.setState({ chosen_path }, this.updatePathOptions.bind(this, false));
    }

    renderPathBrowser() {
        return [
            <div className="section">
                <div className="horizontal flexbox">
                    <button
                        className="padded button"
                        title="Back"
                        onClick={this.backClicked.bind(this)}
                    >
                        <Icon
                            path={mdiArrowLeft}
                            size={1}
                            style={{ verticalAlign: "middle" }}
                        ></Icon>
                    </button>
                    <div className="path padded">{this.state.chosen_path}</div>
                </div>
            </div>,

            <div className="section">
                <div className="list">{this.nextPathSegmentRows()}</div>
            </div>,
        ];
    }

    /////////////// Render ///////////////
    renderModeSelector() {
        const searchClass =
            this.state.mode == "search" ? "padded button selected" : "padded button";
        const browseClass =
            this.state.mode == "browse" ? "padded button selected" : "padded button";

        return (
            <div className="section horizontal flexbox">
                <button
                    className={searchClass}
                    onClick={() => {
                        this.setState({ mode: "search" });
                    }}
                >
                    Search
                </button>
                <button
                    className={browseClass}
                    onClick={() => {
                        this.setState({ mode: "browse" });
                    }}
                >
                    Browse
                </button>
            </div>
        );
    }

    render() {
        const contents =
            this.state.mode == "search" ? this.renderSearch() : this.renderPathBrowser();

        return (
            <div className="centered dialog vertical flexbox">
                <div className="dialogHeader">Add Series</div>
                {this.renderModeSelector()}
                {contents}

                <div className="buttonSection section">
                    <button className="padded" onClick={this.cancelClicked.bind(this)}>
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    cancelClicked(evt: Event) {
        this.props.didCancel?.();
    }
}
