import React from "react"
import { LogApi } from "./LogApi"

// Dropdown menu showing all of the available logs to choose from
export default class PathSelector extends React.Component {

    constructor(props) {
        super(props)

        this.state = {
            logs: props.logs,
            chosen_path: '',
            next_path_segments: []
        }
    }

    componentDidMount() {
        this.update_path_options()
    }

    render() {
      return (
      <div>
        <div className="inline padded">Plot</div>
        <div className="path padded">
            {this.state.chosen_path}
        </div>
        <select name="path" id="path" className="padded" onChange={this.did_select_path_option.bind(this)}>
            {this.get_path_option_elements()}
        </select>
      </div>
      )
    }

    update_path_options() {
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

                console.log('Selected path = ', this.state.chosen_path)

                // Callback
                this.props.on_select_path?.(this.state.chosen_path)

                // Reset the selector
                this.setState({chosen_path: ''}, this.update_path_options.bind(this))

                return
            }

            this.setState({next_path_segments: paths})
        })
    }

    get_path_option_elements() {
        let default_option = [ <option key={"undefined"}>Select</option> ]
        let options = this.state.next_path_segments.map(path_option => {
            return <option value={path_option} key={path_option}>{path_option}</option>
        })

        return default_option.concat(options)
    }

    did_select_path_option(evt) {
        let chosen_path = this.state.chosen_path + '/' + evt.target.value
        this.setState({chosen_path}, this.update_path_options.bind(this))
    }

}
