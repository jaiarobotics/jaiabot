import React from "react"
import ReactDOM from "react-dom/client"

import LoadProfile from "./LoadProfile.js"
import {LogApi} from "./LogApi.js"
import LogSelector from "./LogSelector.js"
import PathSelector from "./PathSelector.js"
import PlotProfiles from "./PlotProfiles.js"

var plot_div_element
var select_path
var path_div

// Plots
var map
var map_points

function update_map(points) {
  if (path_polyline) {
    map.removeLayer(path_polyline)
  }

  map_points = points
  let path = points.map(pt => [pt[1], pt[2]])
  path_polyline = L.polyline(path, {color : 'red'}).addTo(map)

  map.fitBounds(path_polyline.getBounds())
}


// points is in the form [[timestamp, lat, lon]]
var path_polyline

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

            Hello

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

        </div>
        </div>

        <div className = "bottom_pane">
          <div className="plotcontainer">
            <div id="plot" className="plot"></div>
          </div>

          <div className="map" id="map"></div>
        </div>
      </div>)
  }

  componentDidUpdate() {
    if (this.state.chosen_logs.length > 0) {
      LogApi.get_map(this.state.chosen_logs).then(update_map)
    }
    this.refresh_plots()
  }

  componentDidMount() {
    this.getElements()
    this.init_map()
    this.update_log_dropdown()
  }

  init_map() {
    map = L.map('map').setView([ 0, 0 ], 10)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution :
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map)
  
    // Setup the map pin on hover
    this.marker = L.marker([ 0, 0 ])
    this.marker.addTo(map)

  }

  getElements() {
    // Get global element names for the functions that are still using them
    plot_div_element = document.getElementById('plot');
    this.log_select_element = document.getElementById('log')
    select_path = document.getElementById('path')
    path_div = document.getElementById('path_div')
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
          let plots = this.state.plots 
          this.setState({plots : plots.concat(series)})
        })
  }

  refresh_plots() {
    if (this.state.plots.length == 0) {
      Plotly.purge(plot_div_element)
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

    Plotly.newPlot(plot_div_element, data, layout)

    let self = this
    plot_div_element.on('plotly_hover', function(data) {
      let dateString = data.points[0].data.x[data.points[0].pointIndex] 
      let date_timestamp_micros = Date.parse(dateString) * 1e3
      self.did_hover_on_timestamp_micros(date_timestamp_micros)
    })

    plot_div_element.on('plotly_unhover',
                        function(data) { self.marker.setLatLng(new L.LatLng(0, 0)) })
  }

  did_hover_on_timestamp_micros(timestamp_micros) {

    // Get the nearest map_point to a particular point in time
    function point_at_time(t) {
      let start = 0, end = map_points.length - 1

      // Iterate while start not meets end
      while (start <= end) {
        if (end - start <= 1)
          return map_points[start]

          // Find the mid index
          let mid = Math.floor((start + end) / 2)

          // Find which half we're in
          if (t < map_points[mid][0]) {
            end = mid
          }
        else {
          start = mid
        }
      }

      return null
    }
    
    let point = point_at_time(timestamp_micros)

    // Plot point on the map
    if (point) {
      this.marker.setLatLng(new L.LatLng(point[1], point[2]))
    }
  }

}

const root = ReactDOM.createRoot(document.getElementById('root'));
const log_app = <LogApp />;
root.render(log_app);
