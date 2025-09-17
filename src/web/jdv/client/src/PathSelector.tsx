import { mdiArrowLeft, mdiMagnify } from "@mdi/js";
import React from "react";
import { LogApi, SeriesDescriptor, SeriesDescriptor_matchesString } from "./LogApi";
import Icon from "@mdi/react";

interface PathSelectorProps {
    logs: string[];
    didCancel: () => void;
    didSelectPath: (path: string) => void;
}

interface PathSelectorState {
    logs: string[];
    chosen_path: string;
    next_path_segments: string[];
    series_descriptors: SeriesDescriptor[];
    search_results: SeriesDescriptor[];    
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
            chosen_path: "",
            next_path_segments: [],
            series_descriptors: [],
            search_results: [],
        };
    }

    load_series_descriptors() {
        LogApi.getAllSeriesDescriptors(this.state.logs).then((series_descriptors) => {
            this.setState({ series_descriptors: series_descriptors });
        });
    }

    componentDidMount() {
        this.load_series_descriptors()
        this.update_path_options(true);
    }

    
    /**
     * Update search results section to a given query.
     *
     * @param {string} query 
     */
    search(query: string){
        function filter(series_descriptor: SeriesDescriptor): boolean {
            return SeriesDescriptor_matchesString(series_descriptor, query);
        }

        function match_score(series_descriptor: SeriesDescriptor): number {
            let score = 0;
            const name = series_descriptor.name.toLowerCase();
            const path = series_descriptor.path.toLowerCase();
            const q = query.toLowerCase();

            if (name === q) {
                score += 100;
            } else if (name.includes(q)) {
                score += 10;
            }

            if (path === q) {
                score += 80;
            } else if (path.includes(q)) {
                score += 8;
            }

            if (series_descriptor.description !== null) {
                score += 1
                if (series_descriptor.description.includes(q)) {
                    score += 4;
                }
            }

            return score;
        }

        this.setState({search_results: this.state.series_descriptors.filter(filter).sort((a, b) => match_score(b) - match_score(a))}); // Descending
    }

    renderSearchBar() {
        return (
            <div className="section">
                <Icon
                    path={mdiMagnify}
                    size={1}
                    style={{ verticalAlign: "middle" }}
                ></Icon>
                <input
                    className="padded"
                    type="text"
                    placeholder="Search"
                    onChange={(e) => {this.search(e.target.value)}}
                ></input>
            </div>
        )
    }

    renderSearchResults() {
        const resultsRows = this.state.search_results.map((series_descriptor, index) => {
            return (
                <div
                    key={index}
                    className="padded listItem vertical flexbox"
                    onClick={() => {this.props.didSelectPath(series_descriptor.path)}}
                >
                    <div><b>{series_descriptor.name}</b></div>
                    {series_descriptor.description && <div style={{fontSize: "smaller"}}>{series_descriptor.description}</div>}
                    <div style={{fontSize: "smaller", color: "gray", fontStyle: "italic"}}>{series_descriptor.path}</div>
                </div>
            );
        });

        return (
            <div className="section">
                <div className="list">{resultsRows}</div>
            </div>
            )
    }

    
    /** Unused for now */
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
        </div>
        ]
    }

    render() {
        return (
            <div className="centered dialog vertical flexbox">
                <div className="dialogHeader">Add Series</div>
                {this.renderSearchBar()}

                {this.renderSearchResults()}

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

    update_path_options(shouldAutoselect: boolean) {
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
                    this.update_path_options.bind(this, shouldAutoselect),
                );

                return;
            }

            // Only one option, so select it and go to the nexxt level
            if (shouldAutoselect && paths.length == 1) {
                let chosen_path = this.state.chosen_path + "/" + paths[0];
                this.setState(
                    { chosen_path },
                    this.update_path_options.bind(this, shouldAutoselect),
                );
                return;
            }

            // More than one option
            this.setState({ next_path_segments: paths });
        });
    }

    didSelectPathSegmentRow(nextPathSegment: string) {
        let chosen_path = this.state.chosen_path + "/" + nextPathSegment;
        this.setState({ chosen_path: chosen_path }, this.update_path_options.bind(this, true));
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

        this.setState({ chosen_path }, this.update_path_options.bind(this, false));
    }
}
