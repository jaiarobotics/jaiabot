import {
  mdiClose,
  mdiContentSave,
  mdiDownload,
  mdiUpload,
  mdiFolderOpen,
  mdiPlus,
  mdiTrashCan
} from '@mdi/js'
import Icon from '@mdi/react'
import React from "react"
import ReactDOM from "react-dom/client"
import {BrowserRouter as Router} from "react-router-dom"

import {DataTable} from "./DataTable"
import {downloadCSV} from "./DownloadCSV"
import JaiaMap from './JaiaMap'
import {LogApi} from "./LogApi"
import LogSelector from "./LogSelector"
import {OpenPlotSet} from "./OpenPlotSet"
import PathSelector from "./PathSelector"
import {PlotProfiles} from "./PlotProfiles"
import TimeSlider from "./TimeSlider"
import {Plot} from './Plot'
import {Log} from './Log'

var Plotly = require('plotly.js-dist')

const APP_NAME = "Jaia Data Vision"

const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: "medium", timeStyle: "medium" })


// Convert from an ISO date string to microsecond UNIX timestamp
function iso_date_to_micros(iso_date_string: string) {
  return Date.parse(iso_date_string) * 1e3
}


interface LogAppProps {

}


interface State {
  logs: Log[]
  isSelectingLogs: boolean
  chosenLogs: string[]
  plots: Plot[]
  layerSwitcherVisible: boolean
  plotNeedsRefresh: boolean
  mapNeedsRefresh: boolean
  timeFraction: number | null
  t: number | null // Currently selected time
  tMin: number | null // Minimum time for these logs
  tMax: number | null // Maximum time for these logs

  // Plot selection
  isPathSelectorDisplayed: boolean

  // Plot sets
  isOpenPlotSetDisplayed: boolean
}


class LogApp extends React.Component {

  state: State
  map: JaiaMap
  plot_div_element: any

  constructor(props: LogAppProps) {
    super(props)

    this.state = {
      logs: [],
      isSelectingLogs: false,
      chosenLogs : [],
      plots : [],
      layerSwitcherVisible: false,
      plotNeedsRefresh: false,
      mapNeedsRefresh: false,
      timeFraction: null,
      t: null, // Currently selected time
      tMin: null, // Minimum time for these logs
      tMax: null, // Maximum time for these logs

      // Plot selection
      isPathSelectorDisplayed: false,

      // Plot sets
      isOpenPlotSetDisplayed: false,
    }
  }

  render() {
    const self = this;

    // Show log selection box?
    const log_selector = this.state.isSelectingLogs ? <LogSelector key="logSelector" logs={this.state.logs} didSelectLogs={this.didSelectLogs.bind(this)} /> : null

    const chosenLogsFilenames = this.state.chosenLogs.map((input: string) => { return input.split('/').slice(-1) })
    const openLogsListString = chosenLogsFilenames.join(', ')

    return (
      <Router>
        <div className="vertical flexbox maximized">
          <div className = "vertical flexbox top_pane padded">
            <div className = "row">
              <img src = "/favicon.png" className = "jaia-icon" />
              <h2 className="appName">{APP_NAME}</h2>
            </div>
          </div>

          <div>
            <button className="padded" onClick={self.selectLogButtonPressed.bind(self)}>Select Log(s)</button>
            <div id="logList" className="padded">{openLogsListString}</div>
          </div>

          <div className = "bottomPane flexbox horizontal">
            { this.plotSection() }

            <div id="mapPane">
              <div className="flexbox vertical" style={{height:'100%'}}>
                <div style={{width:'100%', flexGrow:1}}>
                  <div className="openlayers-map" id="openlayers-map"></div>
                  <div id="mapControls">
                    <div>
                      <div id="layerSwitcherToggler" className="mapButton" onClick={() => {this.togglerLayerSwitcher()}}>Layers</div>
                      <div id="layerSwitcher" style={{display: this.state.layerSwitcherVisible ? "inline-block" : "none"}}></div>
                    </div>

                    <button id="mapExportButton" className="mapButton" onClick={() => { this.map.exportKml() }}>
                      <Icon path={mdiDownload} size={1} style={{verticalAlign: "middle"}}></Icon>KML
                    </button>
                    <button id="mapImportButton" className="mapButton" onClick={() => { this.map.importKmx() }}>
                      <Icon path={mdiUpload} size={1} style={{verticalAlign: "middle"}}></Icon>KML
                    </button>
                    <button id="clearMapButton" className="mapButton" onClick={() => { this.map.clear() }}>
                      <Icon path={mdiTrashCan} size={1} style={{verticalAlign: "middle"}}></Icon>
                    </button>

                  </div>

                </div>
                <TimeSlider t={this.state.t} tMin={this.state.tMin} tMax={this.state.tMax} onValueChanged={(t) => { 
                  this.map.updateToTimestamp(t)
                  this.setState({t: t })
                }}></TimeSlider>
              </div>
            </div>
          </div>
          { log_selector }
        </div>

      </Router>
    )
  }

  togglerLayerSwitcher() {
    var {layerSwitcherVisible} = this.state
    this.setState({layerSwitcherVisible: !layerSwitcherVisible})
  }

  selectLogButtonPressed(evt: Event) {
    this.setState({isSelectingLogs: true})
  }

  componentDidUpdate() {
    if (this.state.mapNeedsRefresh) {
      if (this.state.chosenLogs.length > 0) {
        // Get map data
        LogApi.get_map(this.state.chosenLogs).then((seriesArray) => {
          this.map.setSeriesArray(seriesArray)
          this.setState({tMin: this.map.tMin, tMax: this.map.tMax, t: this.map.timestamp})
        })

        // Get the command dictionary (botId => [Command])
        LogApi.get_commands(this.state.chosenLogs).then((command_dict) => {
          this.map.updateWithCommands(command_dict)
        })

        // Get the active_goals
        LogApi.get_active_goal(this.state.chosenLogs).then((active_goal_dict) => {
          this.map.updateWithActiveGoal(active_goal_dict)
        })

        // Get the task packets
        LogApi.get_task_packets(this.state.chosenLogs).then((task_packets) => {
          this.map.updateWithTaskPackets(task_packets)
        })

        // Get the depth contours
        LogApi.get_depth_contours(this.state.chosenLogs).then((geoJSON) => {
          this.map.updateWithDepthContourGeoJSON(geoJSON)
        })

      }
      else {
        this.map.clear()
      }

      this.setState({mapNeedsRefresh: false})
    }
    
    if (this.state.plotNeedsRefresh) {
      this.refresh_plots()
    }
  }

  componentDidMount() {
    this.getElements()
    this.map = new JaiaMap('openlayers-map')
    this.update_log_dropdown()
  }

  getElements() {
    // Get global element names for the functions that are still using them
    this.plot_div_element = document.getElementById('plot') as Plotly.PlotlyHTMLElement
  }

  update_log_dropdown() {
    LogApi.get_logs().then(logs => {
      this.setState({logs})
      // this.didSelectLogs(['/var/log/jaiabot/bot_offload/bot3_fleet1_20221010T164115.h5'])
    })
  }

  didSelectLogs(logs?: Log[]) {
    if (logs != null) {
      this.setState({chosenLogs: logs, mapNeedsRefresh: true })
    }

    this.setState({isSelectingLogs: false})
  }

  didSelectPaths(pathArray: string[]) {
    LogApi.get_series(this.state.chosenLogs, pathArray)
        .then((series) => {
          if (series != null) {
            let plots =
                this.state.plots 
                this.setState({plots : plots.concat(series), plotNeedsRefresh: true})
          }
        })
        .catch(err => {alert(err)})

    this.setState({isPathSelectorDisplayed: false})
  }

  get_plot_range() {
    let plotlyElement = this.plot_div_element as any
    const range = plotlyElement.layout?.xaxis?.range
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

    var data: Plotly.Data[] = [];
    var layout: any = {showlegend : false};

    for (let [plot_index, series] of this.state.plots.entries()) {
      // Plot the data in series_list
      let dates = series._utime_.map(utime => new Date(utime / 1e3))
      let hovertext = series.series_y.map(y => series.hovertext?.[y])

      // Set the y-axis for this plot
      layout['yaxis' + (plot_index + 1)] = {title : series.y_axis_title}

      // Add to the data array
      let yaxis = 'y' + (plot_index + 1)

      let trace: Plotly.Data = {
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

    Plotly.newPlot(this.plot_div_element, data, layout).then(() => {
      // Apply plot range to map path
      this.map.timeRange = this.get_plot_range()

      // Setup the triggers
      let self = this
      this.plot_div_element.on('plotly_hover', function(data: Plotly.PlotHoverEvent) {
        let dateString = String(data.points[0].data.x[data.points[0].pointIndex])
        let date_timestamp_micros = iso_date_to_micros(dateString)
        self.map.updateToTimestamp(date_timestamp_micros)
        self.setState({t: date_timestamp_micros})
      })

      this.plot_div_element.on('plotly_unhover',
                          function(data: Plotly.PlotHoverEvent) { self.map.updateToTimestamp(null) })

      // Zooming into plots
      this.plot_div_element.on('plotly_relayout', function(eventdata: Plotly.PlotRelayoutEvent) {

        // When autorange, zoom out to the whole set of points
        if (eventdata['xaxis.autorange']) {
          self.map.timeRange = null
          self.map.updatePath()
          return
        }

        const t0 = iso_date_to_micros(String(eventdata['xaxis.range[0]']))
        const t1 = iso_date_to_micros(String(eventdata['xaxis.range[1]']))

        self.map.timeRange = [t0, t1]
        self.map.updatePath()
      })
    })

    this.setState({plotNeedsRefresh: false})
  }

  moosMessagesButton() {
    return (
      <button className="padded" disabled={this.state.chosenLogs.length == 0} onClick={
        () => {
  
          const t_range = this.get_plot_range()
          this.open_moos_messages(t_range)
        }
      }>Download MOOS Messages...</button>
    )
  }

  open_moos_messages(time_range: number[]) {
    LogApi.get_moos(this.state.chosenLogs, time_range)
  }

  // Plot Section

    plotSection() {
      var actionBar: JSX.Element | null

      if (this.state.chosenLogs.length > 0) {
        actionBar = <div className = "plotButtonBar"><
            button title = "Add Plot" className =
                "plotButton" onClick = {this.addPlotClicked.bind(this)}><
            Icon path = {mdiPlus} size = {1} style =
                {{ verticalAlign: "middle" }}></Icon>
        </button><
            button title = "Load Plot Set" className =
                "plotButton" onClick = {this.loadPlotSetClicked.bind(this)}><
            Icon path = {mdiFolderOpen} size = {1} style =
                {{ verticalAlign: "middle" }}></Icon>
        </button><
            button title = "Save Plot Set" className =
                "plotButton" onClick = {this.savePlotSetClicked.bind(
                    this)}><Icon path = {mdiContentSave} size = {1} style = {
          { verticalAlign: "middle" }
        }></Icon>
        </button><
            button title = "Download CSV" className = "plotButton" disabled =
                {this.state.plots.length == 0} onClick = {
                  () => { downloadCSV(this.state.plots, this.get_plot_range()) }
                }><Icon
                       path = {mdiDownload} size = {1} style = {
                         { verticalAlign: "middle" }
                       }></Icon>CSV
        </button><
            button title = "Clear Plots" className =
                "plotButton" onClick = {this.clearPlotsClicked.bind(
                    this)}><Icon path = {mdiTrashCan} size = {1} style = {
          { verticalAlign: "middle" }
        }></Icon>
        </button></div>
    }
    else {
      actionBar = null
    }

    var pathSelector: JSX.Element | null
    if (this.state.isPathSelectorDisplayed) {
      pathSelector = <PathSelector logs = {this.state.chosenLogs} key =
      {this.state.chosenLogs.join(',')} didSelectPath={ (path: string) => {this.didSelectPaths([path])} } didCancel={ () => {this.setState({isPathSelectorDisplayed: false})} } />
      } else {
        pathSelector = null
      }

      let deleteButtons = this.state.plots.map(
          (plot, plotIndex) => {return (
              <button title = "Clear Plots" className =
                   "plotButton" onClick = {this.deletePlotClicked.bind(
                       this, plotIndex)} key = {plotIndex + '-deleteButton'}>
              <Icon path = {mdiClose} size = {1} style =
                   {{ verticalAlign: "middle" }}></Icon>
        </button>)})

      var openPlotSet: JSX.Element | null
      
      openPlotSet = this.state.isOpenPlotSetDisplayed ? <OpenPlotSet didSelectPlotSet = {this.didOpenPlotSet.bind(this)} /> : null

    return (
      <div className="plotcontainer">
        <h2>Plots</h2>{actionBar} {
              pathSelector}<div className = "horizontal flexbox">
          <div id = "plot" className = "plot">
          </div>
          <div className="vertical flexbox deleteButtonSection">
            { deleteButtons }
          </div>
          </div>
        { DataTable(this.state.plots, this.state.t)}
        { openPlotSet }
      </div>)
    }

    addPlotClicked() { this.setState({isPathSelectorDisplayed : true}) }

    clearPlotsClicked() { this.setState({plots : [], plotNeedsRefresh : true}) }

    deletePlotClicked(plotIndex: number) {
      let {plots} = this.state
      plots.splice(plotIndex, 1) 
      this.setState({plots : plots, plotNeedsRefresh : true})
    }

    loadPlotSetClicked() { this.setState({isOpenPlotSetDisplayed : true}) }

    didOpenPlotSet(plotSet: string[]) {
      this.setState({isOpenPlotSetDisplayed : false}) 
      this.didSelectPaths(plotSet)
    }

    savePlotSetClicked() {
      const plotSetName = prompt("Please name this plot set")

      if (PlotProfiles.exists(plotSetName)) {
        if (!confirm(`Are you sure you want to overwrite plot set named \"${
                plotSetName}?`))
          return
      }

      let pathNames = this.state.plots.map((series) => series.path)
      PlotProfiles.save_profile(plotSetName, pathNames)
    }

}

const root = ReactDOM.createRoot(document.getElementById('root'));
const log_app = <LogApp />;
root.render(log_app);
