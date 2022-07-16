import React from "react"
import ReactDOM from "react-dom/client"
import {LogApi} from "./LogApi.js"
import LogSelector from "./LogSelector.js"
import PathSelector from "./PathSelector.js"
import PlotProfiles from "./PlotProfiles.js"

var plot_div_element
var select_path
var path_div

// Plots

var plots = [];

function refresh_plots() {
  if (plots.length == 0) {
    Plotly.purge(plot_div_element)
    return
  }

  var data = [];
  var layout = {showlegend : false};

  for (let [plot_index, series] of plots.entries()) {
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

  // Get the nearest map_point to a particular point in time
  function point_at_time(t) {
    let start = 0, end = map_points.length - 1

    // Iterate while start not meets end
    while (start <= end) {
      if (end - start <= 1) return map_points[start]

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

  // Setup the map pin on hover
  let marker = L.marker([0, 0])
  marker.addTo(map)

  plot_div_element.on('plotly_hover', function(data) {
    let dateString =
        data.points[0].data.x[data.points[0].pointIndex]
        let date_timestamp_micros =
            Date.parse(dateString) * 1e3
    let point = point_at_time(date_timestamp_micros)

    // Plot point on the map
    if (point) {
      marker.setLatLng(new L.LatLng(point[1], point[2]))
    }
  })

  plot_div_element.on('plotly_unhover',
          function(data) { marker.setLatLng(new L.LatLng(0, 0)) })
}

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
      logs: [],
      chosen_logs: []
    }
  }

  render() {
    return (
      <div>
        <div className="vertical flexbox top_pane padded">

          <div className="row">
            <div>
              <img src="/favicon.png" className="jaia-icon" />
              <h2 style={{display: "inline-block", verticalAlign: "text-bottom", margin: "10pt"}}>Logs</h2>
            </div>
          </div>

          <LogSelector logs={this.state.logs} log_was_selected={this.log_was_selected.bind(this)} />

          <PathSelector logs={this.state.chosen_logs} key={this.state.chosen_logs} on_select_path={this.path_was_selected.bind(this)} />

          <div>
            <button className="padded" onClick={() => {
              plots = []
              refresh_plots()
            }}>Clear Plots</button>

            <LoadProfile did_select_plot_set={(paths) => {
              LogApi.get_series(this.state.chosen_logs, paths).then((series_array) => {
                plots = series_array
                refresh_plots()
              })
            }} />

            <button className="padded" onClick={() => {
              let plot_profile_name = prompt('Save this set of plots as:', 'New Profile')
              let plot_profile = plots.map((series) => series.path)
              PlotProfiles.save_profile(plot_profile_name, plot_profile)
              this.forceUpdate()
            }}>Save Profile</button>

          </div>
        </div>
        
        <div className="bottom_pane">
          <div className="plotcontainer">
            <div id="plot" className="plot"></div>
          </div>

          <div className="map" id="map"></div>
        </div>
      </div>
    )
  }

  componentDidUpdate() {
    if (this.state.chosen_logs.length > 0) {
      LogApi.get_map(this.state.chosen_logs).then(update_map)
    }
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
    LogApi.get_series(this.state.chosen_logs, [ path ]).then((series) => {
      plots = plots.concat(series)
      refresh_plots()
    })
  }

}

const root = ReactDOM.createRoot(document.getElementById('root'));
const log_app = <LogApp />;
root.render(log_app);

function LoadProfile(props) {
  let plot_profiles = PlotProfiles.plot_profiles()

  var plot_profile_names = Object.keys(plot_profiles)
  plot_profile_names.sort()

  let option_elements = plot_profile_names.map((profile_name) => {
    return <option value={profile_name} key={profile_name}>{profile_name}</option>
  })

  var first_option_element = [<option value="none">Load Profile</option>]

  let all_option_elements = first_option_element.concat(option_elements)

  console.log(all_option_elements)

  return (
    <select className="padded" onChange={(evt) => {
      let plot_profile_name = evt.target.value

      if (!plot_profile_name) {
        return
      }

      let plot_set = plot_profiles[plot_profile_name]
      props.did_select_plot_set?.(plot_set)

      evt.target.value = "none"
    }}>{all_option_elements}</select>
  )
}
