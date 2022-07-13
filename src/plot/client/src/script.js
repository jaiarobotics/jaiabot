import {LogApi} from "./api.js"

let plot_div = document.getElementById('plot');
let select_log = document.getElementById('log')
let select_path = document.getElementById('path')
let path_div = document.getElementById('path_div')

// Selecting logs

var path = ''

function update_paths(paths) {
  // This path is a dataset, with no children.  So, get and plot it
  if (paths.length == 0) {
      LogApi.get_series(logs, [ path ])
      .then(series => {
          plots = plots.concat(series)
          refresh_plots()
      })

          // Reset to the root of the file
          path = ''
          path_div.innerHTML = path
          LogApi.get_paths(logs, path).then(update_paths)

          return
  }

  // This path is a group, with children, so drill down
  while (select_path.firstChild) {
    select_path.removeChild(select_path.firstChild);
  }

  paths = [ '...' ].concat(paths)

  for (let path of paths) {
    let option = document.createElement('option')
    option.text = path
    option.selected = false
    select_path.add(option)
  }
}

var logs

export function log_was_selected(evt) {
  logs = [ evt.target.value ]
  LogApi.get_paths(logs, '').then(update_paths) // Get the root paths
  LogApi.get_map(logs).then(update_map)
}

export function path_was_selected(evt) {
  path = path + '/' + evt.target.value
  path_div.innerHTML = path
  LogApi.get_paths(logs, path).then(update_paths)
}

// Plots

var plots = [];

function refresh_plots() {
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

                layout.height = data.length * 300 // in pixels

  Plotly.newPlot(plot_div, data, layout)
}

var map = L.map('map').setView([ 0, 0 ], 10)

function init_map() {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
     attribution :
         '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
   }).addTo(map)

  return

      let plot = document.getElementsByClassName("plotly-graph-div")[0]

  plot.on('plotly_hover', function(data) {
    let dateString =
        data.points[0].data.x[data.points[0].pointIndex] 
        let date_timestamp_ms =
            Date.parse(dateString)
    let date_timestamp_s = date_timestamp_ms / 1000.0
    let point = point_at_time(date_timestamp_s)

    // Plot point on the map
    if (point) {
      marker.setLatLng(new L.LatLng(point[1], point[2]))
    }
  })

  plot.on('plotly_unhover',
          function(data) { marker.setLatLng(new L.LatLng(0, 0)) })
}

// points is in the form [[timestamp, lat, lon]]
var path_polyline

function update_map(points) {
  if (path_polyline) {
    map.removeLayer(path_polyline)
  }

  let path = points.map(pt => [pt[1], pt[2]])
  path_polyline = L.polyline(path, {color : 'red'}).addTo(map)

  map.fitBounds(path_polyline.getBounds())

  function point_at_time(t) {

    let start = 0, end = points.length - 1

    // Iterate while start not meets end
    while (start <= end) {
      // Find the mid index
      let mid = Math.floor((start + end) / 2)

      // If element is present at mid, return True
      if (t >= points[mid][0] && t <= points[mid + 1][0]) return points[mid]

          // Else look in left or right half accordingly
          else if (points[mid][0] < t)
      start = mid + 1
      else end = mid - 1
    }

    return null
  }

  let marker = L.marker([ 0, 0 ])
  marker.addTo(map)
}

// Main

init_map()

LogApi.get_logs().then(logs => {
  for (let log of logs) {
    let date_string = new Date(log.timestamp * 1e3).toLocaleString([], {
      dateStyle : 'medium',
      timeStyle : 'short',
    })

    let option = document.createElement('option')
    option.text = log.filename + '  time: ' + date_string
    option.value = log.filename
    select_log.add(option)
  }
})
