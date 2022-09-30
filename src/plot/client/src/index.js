import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter as Router, Routes, Route } 
       from "react-router-dom"

import LoadProfile from "./LoadProfile.js"
import {LogApi} from "./LogApi.js"
import LogSelector from "./LogSelector.js"
import PathSelector from "./PathSelector.js"
import PlotProfiles from "./PlotProfiles.js"
import Map from "./Map.js"

// Convert from an ISO date string to microsecond UNIX timestamp
function iso_date_to_micros(iso_date_string) {
  return Date.parse(iso_date_string) * 1e3
}


class LogApp extends React.Component {

  constructor(props) {
    super(props)

        this.state = {
      logs : [],
      chosen_logs : [],
      chosen_paths : [],
      plots : []
    }
  }

  render() {
    return (
      <Router>
        <div><div className = "vertical flexbox top_pane padded">

        <div className = "row"><div>
        <img src = "/favicon.png" className = "jaia-icon" /><h2 style = {
          {
            display: "inline-block", verticalAlign: "text-bottom",
                margin: "10pt"
          }
        }>Logs</h2>
            </div>
        </div>

          <LogSelector logs={this.state.logs} log_was_selected={this.log_was_selected.bind(this)} />

        <PathSelector logs = {this.state.chosen_logs} key =
            {this.state.chosen_logs} on_select_path =
        {
          this.path_was_selected.bind(this)
        } />

          <div>
            <button className="padded" onClick={() => {
              this.setState({plots: []})
            }}>Clear Plots</button>

        <LoadProfile did_select_plot_set =
        {
          (paths) => {
            LogApi.get_series(this.state.chosen_logs, paths)
                .then(
                    (series_array) => {this.setState({plots : series_array})})
          }
        } />

            <button className="padded" onClick={() => {
              let plot_profile_name = prompt('Save this set of plots as:', 'New Profile')
              let plot_profile = this.state.plots.map((series) => series.path)
              PlotProfiles.save_profile(plot_profile_name, plot_profile)
              this.forceUpdate()
            }}>Save Profile</button>

            <button className="padded" disabled={this.state.chosen_logs.length == 0} onClick={
              () => {

                const t_range = this.get_plot_range()
                this.open_moos_messages(t_range)
              }
            }>Download MOOS Messages...</button>

            <button className="padded" onClick={() => {
              this.map.clear()
            }}>Clear Map</button>

        </div>
        </div>

        <div className = "bottom_pane">
          <div className="plotcontainer">
            <div id="plot" className="plot"></div>
          </div>

          <div className="map" id="map"></div>
        </div>
        </div>
      </Router>
    )
  }

  componentDidUpdate() {
    if (this.state.chosen_logs.length > 0) {
      // Get map data
      LogApi.get_map(this.state.chosen_logs).then((points) => {
        this.map.updateWithPoints(points)
      })

      // Get the command dictionary (botId => [Command])
      LogApi.get_commands(this.state.chosen_logs).then((command_dict) => {
        this.map.updateWithCommands(command_dict)
      })

      // Get the active_goals
      LogApi.get_active_goal(this.state.chosen_logs).then((active_goal_dict) => {
        this.map.updateWithActiveGoal(active_goal_dict)
      })

      // Get the task packets
      LogApi.get_task_packets(this.state.chosen_logs).then((task_packets) => {
        this.map.updateWithTaskPackets(task_packets)
      })

    }
    this.refresh_plots()
  }

  componentDidMount() {
    this.getElements()
    this.map = new Map('map')
    this.update_log_dropdown()
  }

  getElements() {
    // Get global element names for the functions that are still using them
    this.plot_div_element = document.getElementById('plot')
  }

  update_log_dropdown() {
    LogApi.get_logs().then(logs => {
      this.setState({logs})
    })
  }

  log_was_selected(evt) {
    this.setState({chosen_logs: [ evt.target.value] })
  }

  path_was_selected(path) {
    LogApi.get_series(this.state.chosen_logs, [ path ])
        .then((series) => {
          if (series != null) {
            let plots =
                this.state.plots 
                this.setState({plots : plots.concat(series)})
          }
        })
        .catch(err => {alert(err)})
  }

  get_plot_range() {
    const range = this.plot_div_element.layout?.xaxis?.range
    if (range == null) {
      return [0, 2**60]
    }
    else {
      return range.map(iso_date_to_micros)
    }
  }

  refresh_plots() {
    if (this.state.plots.length == 0) {
      Plotly.purge(this.plot_div_element)
      return
    }

    var data = [];
    var layout = {showlegend : false};

    for (let [plot_index, series] of this.state.plots.entries()) {
      // Plot the data in series_list
      let dates = series._utime_.map(utime => new Date(utime / 1e3))
      let hovertext = series.series_y.map(y => series.hovertext?.[y])

      // Set the y-axis for this plot
      layout['yaxis' + (plot_index + 1)] = {title : series.y_axis_title}

      // Add to the data array
      let yaxis = 'y' + (plot_index + 1)

      let trace = {
        name : series.title,
        x : dates,
        y : series.series_y,
        xaxis : 'x',
        yaxis : yaxis,
        hovertext : hovertext,
        type : 'scatter',
        mode : 'lines+markers'
      }

                  data.push(trace)
    }

    layout.grid = {rows : data.length, columns : 1, pattern : 'coupled'}

                  layout.height = data.length * 300 + 1 // in pixels

    // Preserve current x axis range
    const current_layout_xaxis = this.plot_div_element.layout?.xaxis
    if (current_layout_xaxis != null) {
      layout.xaxis = current_layout_xaxis
    }

    Plotly.newPlot(this.plot_div_element, data, layout)

    // Apply plot range to map path
    this.map.timeRange = this.get_plot_range()

    // Setup the triggers
    let self = this
    this.plot_div_element.on('plotly_hover', function(data) {
      let dateString = data.points[0].data.x[data.points[0].pointIndex] 
      let date_timestamp_micros = iso_date_to_micros(dateString)
      self.map.updateToTimestamp(date_timestamp_micros)
    })

    this.plot_div_element.on('plotly_unhover',
                        function(data) { self.map.updateToTimestamp(null) })

    // Zooming into plots
    this.plot_div_element.on('plotly_relayout', function(eventdata) {

      // When autorange, zoom out to the whole set of points
      if (eventdata['xaxis.autorange']) {
        self.map.timeRange = null
        self.map.updatePath()
        return
      }

      const t0 = iso_date_to_micros(eventdata['xaxis.range[0]'])
      const t1 = iso_date_to_micros(eventdata['xaxis.range[1]'])

      self.map.timeRange = [t0, t1]
      self.map.updatePath()
    })
  }

  open_moos_messages(time_range) {
    LogApi.get_moos(this.state.chosen_logs, time_range)
  }

}

const root = ReactDOM.createRoot(document.getElementById('root'));
const log_app = <LogApp />;
root.render(log_app);
