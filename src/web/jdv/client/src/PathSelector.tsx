import { mdiArrowLeft } from "@mdi/js"
import React from 'react'
import { LogApi } from "./LogApi"
import Icon from "@mdi/react"

interface PathSelectorProps {
    logs: string[]
    didCancel: () => void
    didSelectPath: (path: string) => void
}

interface PathSelectorState {
    logs: string[]
    chosen_path: string
    next_path_segments: string[]
}

// Dropdown menu showing all of the available logs to choose from
export default class PathSelector extends React.Component {

    props: PathSelectorProps
    state: PathSelectorState

    constructor(props: PathSelectorProps) {
        super(props)

        this.state = {
            logs: props.logs,
            chosen_path: '',
            next_path_segments: [],
        }
    }

    componentDidMount() {
        this.update_path_options(true)
    }

    render() {
      return (
      <div className="centered dialog vertical flexbox">
        <div className="dialogHeader">Add Series</div>
        <div className="section">
            <div className="horizontal flexbox">
                <button className="padded button" title="Back" onClick={this.backClicked.bind(this)}>
                    <Icon path={mdiArrowLeft} size={1} style={{verticalAlign: "middle"}}></Icon>
                </button>
                <div className="path padded">
                    {this.state.chosen_path}
                </div>
            </div>
        </div>

        <div className="section">
            <div className="list">
                { this.nextPathSegmentRows() }
            </div>
        </div>

        <div className="buttonSection section">
            <button className="padded" onClick={this.cancelClicked.bind(this)}>Cancel</button>
        </div>
      </div>
      )
    }

    cancelClicked(evt: Event) {
        this.props.didCancel?.()
    }

    update_path_options(shouldAutoselect: boolean) {
        // Clear options
        this.setState({next_path_segments: []})

        if (this.state.logs == null || this.state.logs.length == 0) {
            return
        }

        // Get new options
        LogApi.get_paths(this.state.logs, this.state.chosen_path).then(paths => {

            // This path is a dataset, with no children.  So, get and plot it
            if (paths.length == 0) {
                if (this.state.chosen_path == '') {
                    console.error('No paths returned!')
                    return
                }

                // Callback
                this.props.didSelectPath?.(this.state.chosen_path)

                // Reset the selector
                this.setState({chosen_path: ''}, this.update_path_options.bind(this, shouldAutoselect))

                return
            }

            // Only one option, so select it and go to the nexxt level
            if (shouldAutoselect && paths.length == 1) {
                let chosen_path = this.state.chosen_path + '/' + paths[0]
                this.setState({chosen_path}, this.update_path_options.bind(this, shouldAutoselect))
                return
            }

            // More than one option
            this.setState({next_path_segments: paths})
        })
    }

    didSelectPathSegmentRow(nextPathSegment: string) {
        let chosen_path = this.state.chosen_path + '/' + nextPathSegment
        this.setState({chosen_path: chosen_path}, this.update_path_options.bind(this, true))
    }

    nextPathSegmentRows() {
        return this.state.next_path_segments.map((nextPathSegment, index) => {
            var className = "padded listItem"
            return <div key={index} className={className} onClick={this.didSelectPathSegmentRow.bind(this, nextPathSegment)}>{nextPathSegment}</div>
        })
    }

    backClicked() {
        var {chosen_path} = this.state

        const location = chosen_path.lastIndexOf('/')

        if (location != -1) {
            chosen_path = chosen_path.substring(0, location)
        }

        this.setState({chosen_path}, this.update_path_options.bind(this, false))
    }

}
