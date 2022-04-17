/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/self-closing-comp */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/sort-comp */
/* eslint-disable react/no-danger */
/* eslint-disable max-len */
/* eslint-disable react/no-unused-state */
/* eslint-disable react/no-multi-comp */

import React from 'react';

// Material Design Icons
import Icon from '@mdi/react'
import { mdiDelete, mdiPlay } from '@mdi/js'

import OlMap from 'ol/Map';
import OlView from 'ol/View';
import OlText from 'ol/style/Text';
import OlLayerGroup from 'ol/layer/Group';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceXYZ from 'ol/source/XYZ';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import OlPoint from 'ol/geom/Point';
import OlFeature from 'ol/Feature';
import OlTileLayer from 'ol/layer/Tile';
import { click } from 'ol/events/condition';
import OlSelect from 'ol/interaction/Select';
import { createEmpty as OlCreateEmptyExtent, extend as OlExtendExtent } from 'ol/extent';
import OlScaleLine from 'ol/control/ScaleLine';
import OlMousePosition from 'ol/control/MousePosition';
import OlZoom from 'ol/control/Zoom';
import OlRotate from 'ol/control/Rotate';
import { createStringXY as OlCreateStringXY } from 'ol/coordinate';
import OlGeolocation from 'ol/Geolocation';
import { unByKey as OlUnobserveByKey } from 'ol/Observable';
import { getLength as OlGetLength } from 'ol/sphere';
import { LineString as OlLineString } from 'ol/geom';
import OlDrawInteraction from 'ol/interaction/Draw';
import {
  Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlLayerSwitcher from 'ol-layerswitcher';
import OlGraticule from 'ol/Graticule';
import OlStroke from 'ol/style/Stroke';
import OlAttribution from 'ol/control/Attribution';
import { getTransform } from 'ol/proj';

import $ from 'jquery';
// import 'jquery-ui/themes/base/core.css';
// import 'jquery-ui/themes/base/theme.css';
import 'jquery-ui/ui/widgets/resizable';
// import 'jquery-ui/themes/base/resizable.css';
import 'jquery-ui/ui/widgets/slider';
// import 'jquery-ui/themes/base/slider.css';
import 'jquery-ui/ui/widgets/sortable';
// import 'jquery-ui/themes/base/sortable.css';
import 'jquery-ui/ui/widgets/button';
// import 'jquery-ui/themes/base/button.css';
import 'jquery-ui/ui/effects/effect-blind';
// import 'jquery-ui/themes/base/checkboxradio.css';
// import 'jquery-ui/ui/widgets/checkboxradio';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faGripVertical,
  faCrosshairs,
  faChevronDown,
  faChevronLeft,
  faDharmachakra,
  faMapMarkerAlt,
  faMapPin,
  faMapMarkedAlt,
  faRuler,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';


// import cmdIconDefault from '../icons/other_commands/default.png';

// const element = <FontAwesomeIcon icon={faCoffee} />

import {BotDetailsComponent} from './BotDetails'
import JaiaAPI from '../../common/JaiaAPI';

import shapes from '../libs/shapes';
import tooltips from '../libs/tooltips';
import JsonAPI from '../../common/JsonAPI';

// jQuery UI touch punch
import punchJQuery from '../libs/jquery.ui.touch-punch';

import {
  error, success, warning, info} from '../libs/notifications';

// Don't use any third party css exept reset-css!
import 'reset-css';
// import 'ol-layerswitcher/src/ol-layerswitcher.css';
import '../style/AXUI.less';
import { transform } from 'ol/proj';

// Must prefix less-vars-loader with ! to disable less-loader, otherwise less-vars-loader will get JS (less-loader
// output) as input instead of the less.
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
const lessVars = require('!less-vars-loader?camelCase,resolveVariables!../style/AXUI.less');

const COLOR_SELECTED = lessVars.selectedColor;

punchJQuery($);
// jqueryDrawer($);

const { getBoatStyle } = shapes;
const { getClientPositionStyle } = shapes;

// Sorry, map is a global because it really gets used from everywhere
let map;
const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

const viewportDefaultPadding = 100;
const sidebarInitialWidth = 0;
const sidebarMinWidth = 0;
const sidebarMaxWidth = 1500;


const P0 = {location: {lon: -71.273056, lat: 41.662665}}
const P1 = {location: {lon: -71.2732990507409, lat: 41.66249821600168}}
const P2 = {location: {lon: -71.27355703837601, lat: 41.66201485801076}}
const P3 = {location: {lon: -71.27382208146715, lat: 41.66166863453342}}

const dive_task = {
  type: "DIVE",
  dive: {
    max_depth: 2,
    depth_interval: 1,
    hold_time: 0
  }
}

const P0_dive = {location: {lon: -71.273056, lat: 41.662665}, task: dive_task}
const P1_dive = {location: {lon: -71.2732990507409, lat: 41.66249821600168}, task: dive_task}
const P2_dive = {location: {lon: -71.27355703837601, lat: 41.66201485801076}, task: dive_task}
const P3_dive = {location: {lon: -71.27382208146715, lat: 41.66166863453342}, task: dive_task}

function _mission(goals) {
  const mission = {
    botId: 0,
    time: '1642891753471247',
    type: 'MISSION_PLAN',
    plan: {
      start: 'START_IMMEDIATELY',
      movement: 'TRANSIT',
      goal: goals,
      recovery: {recoverAtFinalGoal: true}
    }
  }
  return mission
}

const missions = [
  _mission([P0]),
  _mission([P1]),
  _mission([P2]),
  _mission([P3]),
  _mission([P0_dive]),
  _mission([P1_dive]),
  _mission([P2_dive]),
  _mission([P3_dive]),
]

// Saving and loading settings from browser's localStorage

function readSetting(key) {
  let valueString = localStorage.getItem(key)
  if (!valueString) {
    return null
  }
  else {
    return JSON.parse(valueString)
  }
}

function writeSetting(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function saveVisibleLayers() {
  writeSetting("visibleLayers", visibleLayers)
}

var visibleLayers = new Set()

function loadVisibleLayers() {
  visibleLayers = new Set(readSetting('visibleLayers') || ['OpenStreetMap'])
}

function makeLayerSavable(layer) {
  let title = layer.get("title")

  // Set visible if it should be
  let visible = visibleLayers.has(title)
  layer.set("visible", visible)

  // Catch change in visible state
  layer.on("change:visible", () => {
    if (layer.getVisible()) {
      visibleLayers.add(title)
    }
    else {
      visibleLayers.delete(title)
    }
    saveVisibleLayers()
  })
}

loadVisibleLayers()

// ===========================================================================================================================

// ===========================================================================================================================

export default class AXUI extends React.Component {

  constructor(props) {
    super(props);

    this.mapDivId = `map-${Math.round(Math.random() * 100000000)}`;

    this.sna = new JaiaAPI("/jaia", false);

    this.mapTilesAPI = JsonAPI('/tiles');

    this.missions = {}

    this.state = {
      error: {},
      // User interaction modes
      mode: 'exec',
      currentInteraction: null,
      mapZoomLevel: 14,
      controlSpeed: 0,
      controlHeading: 0,
      accelerationProfileIndex: 0,

      botsDrawerOpen: false,
      commandDrawerOpen: false,
      // Map layers
      botsLayerCollection: new OlCollection([], { unique: true }),
      chartLayerCollection: new OlCollection([], { unique: true }),
      baseLayerCollection: new OlCollection([], { unique: true }),
      selectedBotsFeatureCollection: new OlCollection([], { unique: true }),
      liveCommand: {
        type: '',
        parameters: [],
        formationParameters: [0, 0, 0, 10]
      },
      // incoming data
      lastBotCount: 0,
      faultCounts: { faultLevel0Count: 0, faultLevel1Count: 0, faultLevel2Count: 0 },
      botExtents: {},
      trackingTarget: '',
      viewportPadding: [
        viewportDefaultPadding,
        viewportDefaultPadding,
        viewportDefaultPadding,
        viewportDefaultPadding + sidebarInitialWidth
      ],
      selectedMissionAction: -1,
      measureFeature: null,
      measureActive: false
    };

    this.missionPlanMarkers = new Map();
    this.missionPlanMarkerExtents = new Map();

    const getChartLayerXYZ = (chart) => {
      const sourceOpts = {
        transitionEffect: 'resize',
        transition: 0,
        projection: chart.projection || 'EPSG:3857',
        wrapX: false,
        maxZoom: chart.maxZoom || 19
      };
      if (chart.getUrl) {
        sourceOpts.tileUrlFunction = chart.getUrl;
      } else {
        sourceOpts.url = chart.url
          || `/tiles/${chart.id}/{z}/{x}/{${chart.invertY ? '-' : ''}y}${chart.extension ? `.${chart.extension}` : ''}`;
      }
      var layer = new OlTileLayer({
        title: chart.name,
        source: new OlSourceXYZ(sourceOpts),
        type: "base",
        visible: visibleLayers.has(chart.name),
        // preload: 5, // Lowest number that works at whatever our max zoom level is for the NOAA chart of Fall River
        preload: Infinity,
        useInterimTilesOnError: false
      });

      makeLayerSavable(layer)

      return layer
    };


    const { chartLayerCollection } = this.state;

    // Get custom map tile sets installed on base station into chartLayerCollection
    this.mapTilesAPI.get('index').then(
      (result) => {
        if (result.ok) {
          result.maps.reverse().forEach((chart) => {
            if (chart.type === 'TileXYZ') {
              chartLayerCollection.push(getChartLayerXYZ(chart));
            } else if (chart.type === 'Group') {
              const chartGroupLayerCollection = new OlCollection([], { unique: true });
              const chartGroup = new OlLayerGroup({
                title: chart.name,
                layers: chartGroupLayerCollection,
                fold: 'open'
              });
              chart.maps.reverse().forEach((subChart) => {
                if (subChart.type === 'TileXYZ') {
                  chartGroupLayerCollection.push(getChartLayerXYZ(subChart));
                }
              });
              chartLayerCollection.push(chartGroup);
            }
          });
          // redraw layer list
          OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'));
        } else {
          error(`Failed to find charts: ${result.msg}`);
        }
      },
      (failReason) => {
        error(`Failed to connect to charts: ${failReason}`);
      }
    );

    this.chartLayerGroup = new OlLayerGroup({
      title: 'Charts and Imagery',
      layers: chartLayerCollection,
      fold: 'open'
    });

    const { baseLayerCollection } = this.state;

    [
      new OlTileLayer({
        title: 'NOAA Charts',
        type: 'base',
        source: new OlSourceXYZ({ url: 'http://tileservice.charts.noaa.gov/tiles/50000_1/{z}/{x}/{y}.png' })
      }),
      new OlTileLayer({
        title: 'Google Satellite & Roads',
        type: 'base',
        source: new OlSourceXYZ({ url: 'http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' }),
      }),
      new OlTileLayer({
        title: 'OpenStreetMap',
        type: 'base',
        source: new OlSourceOsm()
      })
    ].forEach((layer) => {
      makeLayerSavable(layer);
      baseLayerCollection.push(layer);
    });

    this.clientAccuracyFeature = new OlFeature();

    this.clientPositionFeature = new OlFeature();
    this.clientPositionFeature.setStyle(getClientPositionStyle());
    this.clientPositionLayer = new OlVectorLayer({
      // title: 'User Position',
      source: new OlVectorSource({
        features: [this.clientAccuracyFeature, this.clientPositionFeature]
      })
    });

    // Measure tool

    const measureSource = new OlVectorSource();

    this.measureLayer = new OlVectorLayer({
      source: measureSource,
      style: new OlStyle({
        fill: new OlFillStyle({
          color: 'rgba(255, 255, 255, 0.2)'
        }),
        stroke: new OlStrokeStyle({
          color: '#ffcc33',
          width: 2
        }),
        image: new OlCircleStyle({
          radius: 7,
          fill: new OlFillStyle({
            color: '#ffcc33'
          })
        })
      })
    });

    const {
      botsLayerCollection,
      selectedBotsFeatureCollection    } = this.state;

    this.botsLayerGroup = new OlLayerGroup({
      // title: 'Bots',
      // fold: 'open',
      layers: botsLayerCollection
    });

    map = new OlMap({
      layers: this.createLayers(),
      controls: [
        new OlZoom(),
        new OlRotate(),
        new OlScaleLine({ units: 'metric' }),
        new OlMousePosition({
          coordinateFormat: OlCreateStringXY(6),
          projection: equirectangular,
          undefinedHTML: '&nbsp;'
        }),
        new OlAttribution({
          collapsible: false
        })
      ],
      view: new OlView({
        projection: mercator,
        center: [0, 0],
        zoom: 0,
        maxZoom: 24
      }),
      maxTilesLoading: 64,
      loadTilesWhileAnimating: true,
      loadTilesWhileInteracting: true,
      moveTolerance: 20
    });

    map.on('click', this.didClickMap.bind(this))

    const graticule = new OlGraticule({
      // the style to use for the lines, optional.
      // Do not use dashes because it will very quickly overload the renderer and the entire JS engiine
      strokeStyle: new OlStroke({
        color: 'black',
        width: 1
      }),
      showLabels: true,
      latLabelStyle: new OlText({
        font: '16px sans-serif',
        fill: new OlFillStyle({
          color: 'maroon'
        }),
        textAlign: 'end',
        offsetX: -4,
        offsetY: -10,
      }),
      lonLabelStyle: new OlText({
        font: '16px sans-serif',
        fill: new OlFillStyle({
          color: 'maroon'
        }),
        textBaseline: 'bottom',
      }),
      targetSize: 150,
    });

    graticule.setMap(map);

    this.geolocation = new OlGeolocation({
      trackingOptions: {
        enableHighAccuracy: true // Needed to get heading
      },
      projection: mercator
    });

    this.clientLocation = {};

    this.geolocation.on('change', () => {
      // console.log('Position and heading:');
      // console.log(this.geolocation.getPosition());
      // console.log(this.geolocation.getHeading());
      const lat = parseFloat(this.geolocation.getPosition()[1]);
      const lon = parseFloat(this.geolocation.getPosition()[0]);
      if (Number.isNaN(lat) || Number.isNaN(lon) || lat > 90 || lat < -90 || lon > 360 || lon < -180) {
        this.clientLocation.isValid = false;
        return;
      }
      this.clientLocation.isValid = true;
      this.clientLocation.position = [lon, lat];
      this.clientLocation.accuracy = parseFloat(this.geolocation.getAccuracy());
      this.clientLocation.altitude = this.geolocation.getAltitude();
      this.clientLocation.altitudeAccuracy = this.geolocation.getAltitudeAccuracy();
      this.clientLocation.heading = parseFloat(this.geolocation.getHeading());
      this.clientLocation.speed = this.geolocation.getSpeed();
      const { trackingTarget } = this.state;
      if (trackingTarget === 'user') {
        this.centerOn(this.clientLocation.position);
        const { heading } = this.clientLocation;
        if (!Number.isNaN(heading)) {
          map.getView().setRotation(-heading);
        }
      }
      this.sna
        .sendClientLocation(
          this.clientLocation.accuracy < 10,
          this.clientLocation.position[1],
          this.clientLocation.position[0]
        )
        .then(
          () => {},
          () => {
            console.error('Failed to send user location to topside system.');
          }
        );
    });

    // handle geolocation error.
    this.geolocation.on('error', (err) => {
      error(err.message);
      const { trackingTarget } = this.state;
      if (trackingTarget === 'user' || trackingTarget === 'all') {
        this.trackBot('');
      }
    });

    this.geolocation.on('change:position', () => {
      const lat = parseFloat(this.geolocation.getPosition()[1]);
      const lon = parseFloat(this.geolocation.getPosition()[0]);
      if (Number.isNaN(lat) || Number.isNaN(lon) || lat > 90 || lat < -90 || lon > 360 || lon < -180) {
        this.clientLocation.isValid = false;
        return;
      }
      this.clientPositionFeature.setGeometry(new OlPoint([lon, lat]));
    });
    this.geolocation.on('change:accuracyGeometry', () => {
      // console.debug('Accuracy geometry:');
      // console.debug(this.geolocation.getAccuracyGeometry());
      if (!this.geolocation.getAccuracyGeometry()) {
        return;
      }
      this.clientAccuracyFeature.setGeometry(this.geolocation.getAccuracyGeometry());
    });

    // select interaction working on "click"
    this.selectBotInteraction = new OlSelect({
      condition: click,
      style: getBoatStyle(map, COLOR_SELECTED),
      layers: botsLayerCollection.getArray(),
      features: selectedBotsFeatureCollection
    });

    const us = this;
    this.selectBotInteraction.on('select', (e) => {
      const ids = e.selected.map(feature => feature.getId());
      us.selectBots(ids);
    });

    this.measureInteraction = new OlDrawInteraction({
      source: this.measureSource,
      type: 'LineString',
      style: new OlStyle({
        fill: new OlFillStyle({
          color: 'rgba(255, 255, 255, 0.2)'
        }),
        stroke: new OlStrokeStyle({
          color: 'rgba(0, 0, 0, 0.5)',
          lineDash: [10, 10],
          width: 2
        }),
        image: new OlCircleStyle({
          radius: 5,
          stroke: new OlStrokeStyle({
            color: 'rgba(0, 0, 0, 0.7)'
          }),
          fill: new OlFillStyle({
            color: 'rgba(255, 255, 255, 0.2)'
          })
        })
      })
    });

    let listener;
    this.measureInteraction.on(
      'drawstart',
      (evt) => {
        this.setState({ measureFeature: evt.feature });


        listener = evt.feature.getGeometry().on('change', (evt2) => {
          const geom = evt2.target;
          // tooltipCoord = geom.getLastCoordinate();
          $('#measureResult').text(AXUI.formatLength(geom));
        });
      },
      this
    );

    this.measureInteraction.on(
      'drawend',
      () => {
        this.setState({ measureActive: false, measureFeature: null });
        OlUnobserveByKey(listener);
        this.changeInteraction();
      },
      this
    );

    // Callbacks
    this.changeInteraction = this.changeInteraction.bind(this);

    this.setViewport = this.setViewport.bind(this);
    this.centerOn = this.centerOn.bind(this);
    this.fit = this.fit.bind(this);

    this.sendStop = this.sendStop.bind(this);

    // center persistence
    map.getView().setCenter(readSetting("center") || equirectangular_to_mercator([-71.272237, 41.663559]))

    map.getView().on('change:center', function() {
      writeSetting('center', map.getView().getCenter())
    })

    // zoomLevel persistence
    map.getView().setZoom(readSetting("zoomLevel") || 2)

    map.getView().on('change:resolution', function() {
      writeSetting('zoomLevel', map.getView().getZoom())
    })

    // rotation persistence
    map.getView().setRotation(readSetting("rotation") || 0)

    map.getView().on('change:rotation', function() {
      writeSetting('rotation', map.getView().getRotation())
    })

  }

  createLayers() {
    this.missionLayer = new OlVectorLayer()
  
    let layers = [
      new OlLayerGroup({
        title: 'Base Maps (internet connection required)',
        fold: 'open',
        layers: this.state.baseLayerCollection
      }),
      this.chartLayerGroup,
      this.botsLayerGroup,
      this.clientPositionLayer,
      this.measureLayer,
      this.missionLayer,
    ]

    return layers
  }

  componentDidMount() {
    map.setTarget(this.mapDivId);
    map.addInteraction(this.selectBotInteraction);

    const viewport = document.getElementById(this.mapDivId);
    map.getView().setMinZoom(Math.ceil(Math.LOG2E * Math.log(viewport.clientWidth / 256)));

    this.geolocation.setTracking(true);

    const us = this;


		this.timerID = setInterval(() => this.pollPodStatus(), 2500);

    $('#leftSidebar').resizable({
      containment: 'parent',
      handles: null,
      maxWidth: sidebarMaxWidth,
      minWidth: sidebarMinWidth,
      resize(ui) {
        us.setViewport([0, 0, 0, ui.size.width]);
      }
    });
    
    let sidebarResizeHandle = document.getElementById('sidebarResizeHandle')
    let leftSidebar = document.getElementById('leftSidebar')
    sidebarResizeHandle.onclick = function() {
      if (leftSidebar.style.width == "400px") {
        leftSidebar.style.width = "0px"
      }
      else {
        leftSidebar.style.width = "400px"
      }
    }

    /*
    $('.panelsContainerVertical').sortable({
      handle: 'h2',
      placeholder: 'sortable-placeholder'
    });
    */
    $('.panel > h2').disableSelection();
    // } else {
    //   $('#leftSidebar').hide();
    // }

    /*
    map.on('pointermove', (event) => {
      this.setState({
        cursorLocation: {
          latitude: event.coordinate[1],
          longitude: event.coordinate[0]
        }
      });
    });
    */

    map.getView().on('change:resolution', () => {
      this.setState({
        mapZoomLevel: map.getView().getZoom()
      });
    });

    /*
        This needs to be called whenever liveCommand is updated externally, but NOT in the render method
        */

    const { controlSpeed } = this.state;
    $('#speedSlider').slider({
      max: 100,
      min: 0,
      orientation: 'horizontal',
      value: controlSpeed,
      slide(ui) {
        us.sendThrottle(ui.value);
      }
    });

    OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'));
    // $('input').checkboxradio();

    $('button').disableSelection();

    tooltips();

    $('#botsDrawer').hide('blind', { direction: 'up' }, 0);
    $('#mapLayers').hide('blind', { direction: 'right' }, 0);

    info('Welcome to Central Command!');
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // TODO move map-based rendering here
    // Here we can check the previous state against the current state and update the map
    // layers to reflect changes that we can't handle in render() directly.
    // Note that calling setState() here will cause another cycle, beware of infinite loops
    /* Need to detect when an input field is rendered, then call this on it:
        This will make the keyboard "go" button close the keyboard instead of doing nothing.
    $('input').keypress(function(e) {
        var code = (e.keyCode ? e.keyCode : e.which);
        if ( (code==13) || (code==10))
            {
            jQuery(this).blur();
            return false;
            }
    });
    */
  }

  componentWillUnmount() {
    clearInterval(this.timerID);
    clearTimeout(this.accelTimer);
  }

  getLiveLayerFromBotId(bot_id) {
    const { botsLayerCollection } = this.state;
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < botsLayerCollection.getLength(); i++) {
      const layer = botsLayerCollection.item(i);
      if (layer.bot_id === bot_id) {
        return layer;
      }
    }

    const botFeature = new OlFeature({
      name: bot_id,
      geometry: new OlPoint([0, 0])
    });

    botFeature.setId(bot_id);
    botFeature.setStyle(getBoatStyle(map));

    const botLayer = new OlVectorLayer({
      name: bot_id,
      title: bot_id,
      source: new OlVectorSource({
        wrapX: false,
        features: new OlCollection([botFeature], { unique: true })
      })
    });

    botLayer.setStyle(getBoatStyle(map));

    botLayer.bot_id = bot_id;

    botsLayerCollection.push(botLayer);

    OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'));
    // $('input').checkboxradio();

    return botsLayerCollection.item(botsLayerCollection.getLength() - 1);
  }

  changeInteraction(newInteraction = null, cursor = '') {
    const { currentInteraction } = this.state;
    if (currentInteraction !== null) {
      map.removeInteraction(currentInteraction);
    }
    if (newInteraction !== null) {
      map.addInteraction(newInteraction);
      this.setState({ currentInteraction: newInteraction });
    }
    map.getTargetElement().style.cursor = cursor;
  }

  defaultInteraction() {
    this.changeInteraction();
  }


  setViewport(dims) {
    const { viewportPadding } = this.state;
    this.setState({
      viewportPadding: [
        viewportDefaultPadding + dims[0],
        viewportDefaultPadding + dims[1],
        viewportDefaultPadding + dims[2],
        viewportDefaultPadding + dims[3]
      ]
    });
  }

  setViewportEdge(edge, padding) {
    const { viewportPadding } = this.state;
    viewportPadding[edge] = viewportDefaultPadding + padding;
    this.setState({
      viewportPadding
    });
  }

  centerOn(coords, stopTracking = false, firstMove = false) {
    console.info('Centering on:');
    console.info(coords);
    if (stopTracking) {
      this.trackBot('');
    }
    const floatCoords = [parseFloat(coords[0]), parseFloat(coords[1])];
    const { viewportPadding } = this.state;
    const size = map.getSize();
    const viewportCenterX = (size[0] - viewportPadding[1] - viewportPadding[3]) / 2 + viewportPadding[3];
    const viewportCenterY = (size[1] - viewportPadding[0] - viewportPadding[2]) / 2 + viewportPadding[0];
    const viewportCenter = [viewportCenterX, viewportCenterY];
    // console.info('Viewport center:');
    // console.info(viewportCenter);
    map.getView().centerOn(floatCoords, size, viewportCenter);
    if (firstMove && map.getView().getZoom() < 16) {
      console.info(`Zooming from level ${map.getView().getZoom()} to 16`);
      map.getView().setZoom(16);
    }
    // map.render();
  }

  fit(geom, opts, stopTracking = false, firstMove = false) {
    if (stopTracking) {
      this.trackBot('');
    }
    const { viewportPadding } = this.state;
    const size = map.getSize();
    const origZoom = map.getView().getZoom();
    const newRes = map.getView().getResolutionForExtent(geom, size);
    const optsOverride = {};
//     if (!firstMove) {
      optsOverride.maxZoom = origZoom;
//     }
    map.getView().fit(
      geom,
      Object.assign(
        {
          size,
          padding: viewportPadding
        },
        opts,
        optsOverride
      )
    );
    // map.render();
  }

  // POLL THE BOTS
  pollPodStatus() {
    clearInterval(this.timerID);
    const us = this;

    this.sna.getStatus().then(
      (result) => {
        if (!("bots" in result)) {
          this.podStatus = {}
          error('Unable to load Pod data!')
          console.error(result)
          this.timerID = setInterval(() => this.pollPodStatus(), 2500)
        }
        else {
          this.podStatus = result
        }
      },
      (err) => {
        this.setState({
          error: err
        });
        this.timerID = setInterval(() => this.pollPodStatus(), 2500);
        error('Unable to connect to pod interface.');
      }
    )

    this.sna.getOldStatus().then(
      (result) => {
        const { selectedBotsFeatureCollection } = this.state;

        if (!Array.isArray(result.bots)) {
          // No bots connected to hub
          return;
        }

        let faultLevel0Count = 0;
        let faultLevel1Count = 0;
        let faultLevel2Count = 0;

        const { trackingTarget } = this.state;

        const botExtents = {};
        // This needs to be synchronized somehow?
        result.bots.forEach((bot) => {
          // ID
          const bot_id = bot.botID.toString();
          // Geometry
          const botLatitude = bot.location.lat;
          const botLongitude = bot.location.lon;
          // Properties
          const botHeading = bot.heading;
          const botSpeed = bot.velocity;
          const botTimestamp = new Date(null);
          botTimestamp.setSeconds(bot.time.time);

          const botLayer = this.getLiveLayerFromBotId(bot_id);

          const botFeature = new OlFeature({});

          botFeature.setId(bot_id);

          const coordinate = equirectangular_to_mercator([parseFloat(botLongitude), parseFloat(botLatitude)]);

          // Emits changed:geometry event?
          botFeature.setGeometry(new OlPoint(coordinate));
          botFeature.setProperties({
            heading: botHeading,
            speed: botSpeed,
            lastUpdated: parseFloat(bot.time.time),
            lastUpdatedString: botTimestamp.toISOString()
            // rawData: bot
          });

          Object.getOwnPropertyNames(bot).forEach((property) => {
            if (typeof bot[property] !== 'object' && bot[property] !== null) {
              botFeature.set(property, bot[property].toString());
            }
          });

          if (Array.isArray(bot.sensorData)) {
            bot.sensorData.forEach((sensor) => {
              botFeature.set(sensor.sensorName, sensor.sensorValue);
            });
          }

          let faultLevel = 0;

          const rfState = parseInt(botFeature.get('commState') || 0, 10);
          const faultState = parseInt(botFeature.get('faultState') || 0, 10);
          // const commandState = parseInt(botFeature.get('commandState') || 0, 10);
          const batteryState = parseInt(botFeature.get('batteryState') || 0, 10);

          if (rfState >= 2 || faultState === 6) {
            faultLevel = 2;
            faultLevel2Count += 1;
          } else if (rfState === 1) {
            faultLevel = 2;
            faultLevel2Count += 1;
          } else if ((faultState >= 4 && faultState !== 7) || batteryState >= 7) {
            faultLevel = 2;
            faultLevel2Count += 1;
          } else if ((faultState >= 1 && faultState !== 7) || batteryState >= 3) {
            faultLevel = 1;
            faultLevel1Count += 1;
          } else {
            faultLevel0Count += 1;
          }

          botFeature.set('faultLevel', faultLevel);

          const zoomExtentWidth = 0.001; // Degrees

          // An array of numbers representing an extent: [minx, miny, maxx, maxy].
          botExtents[bot_id] = [
            botLongitude - zoomExtentWidth / 2,
            botLatitude - zoomExtentWidth / 2,
            botLongitude + zoomExtentWidth / 2,
            botLatitude + zoomExtentWidth / 2
          ];

          botFeature.set('selected', false);
          botFeature.set('controlled', false);
          botFeature.set('tracked', false);
          botFeature.set('completed', false);

          // Update feature in selected set
          if (selectedBotsFeatureCollection.getLength() !== 0) {
            for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
              const feature = selectedBotsFeatureCollection.item(i);
              if (feature.getId() === bot_id) {
                botFeature.set('selected', true);
                selectedBotsFeatureCollection.setAt(i, botFeature);
                break;
              }
            }
          }

          if (trackingTarget === bot_id) {
            botFeature.set('tracked', true);
          }

          botLayer.getSource().clear();
          botLayer.getSource().addFeature(botFeature);

          if (trackingTarget === bot_id) {
            us.centerOn(botFeature.getGeometry().getCoordinates());
          }

          if (botFeature.get('controlled')) {
            botLayer.setZIndex(3);
          } else if (botFeature.get('selected')) {
            botLayer.setZIndex(2);
          } else if (botFeature.get('tracked')) {
            botLayer.setZIndex(1);
          } else {
            botLayer.setZIndex(0);
          }

          botLayer.changed();
        }); // end foreach bot
        const { lastBotCount } = this.state;
        const botCount = result.bots.length;
        if (botCount > lastBotCount) {
          this.zoomToAllBots(true);
        } else if (trackingTarget === 'pod') {
          this.zoomToAllBots();
        } else if (trackingTarget === 'all') {
          this.zoomToAll();
        }
        this.setState({
          botExtents,
          selectedBotsFeatureCollection,
          faultCounts: { faultLevel0Count, faultLevel1Count, faultLevel2Count },
          lastBotCount: botCount
        });
        // map.render();
        this.timerID = setInterval(() => this.pollPodStatus(), 250);
      },
      // Note: it's important to handle errors here
      // instead of a catch() block so that we don't swallow
      // exceptions from actual bugs in components.
      (err) => {
        this.setState({
          error: err
        });
        this.timerID = setInterval(() => this.pollPodStatus(), 2500);
        error('Unable to connect to pod interface.');
      }
    );
  }

  disconnectPod() {
    // This should always work because we're single threaded, right?
    clearInterval(this.timerID);
  }

  zoomToAllBots(firstMove = false) {
    if (this.botsLayerGroup.getLayers().getLength() <= 0) {
      return;
    }
    const extent = OlCreateEmptyExtent();
    let layerCount = 0;
    this.botsLayerGroup.getLayers().forEach((layer) => {
      if (layer.getSource().getFeatures().length <= 0) return;
      OlExtendExtent(extent, layer.getSource().getExtent());
      layerCount += 1;
    });
    if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
  }

  zoomToAll(firstMove = false) {
    const extent = OlCreateEmptyExtent();
    let layerCount = 0;
    const addExtent = (layer) => {
      if (layer.getSource().getFeatures().length <= 0) return;
      OlExtendExtent(extent, layer.getSource().getExtent());
      layerCount += 1;
    };
    this.botsLayerGroup.getLayers().forEach(addExtent);
    if (this.clientLocation.isValid) {
      addExtent(this.clientPositionLayer);
    }
    if (layerCount > 0) this.fit(extent, { duration: 100 }, false, firstMove);
  }

  selectBot(bot_id) {
    this.selectBots([bot_id]);
  }

  selectBots(bot_ids) {
    const { botsLayerCollection, selectedBotsFeatureCollection } = this.state;
    selectedBotsFeatureCollection.clear();
    botsLayerCollection.getArray().forEach((layer) => {
      const feature = layer.getSource().getFeatureById(layer.bot_id);
      if (feature) {
        if (bot_ids.includes(feature.getId())) {
          feature.set('selected', true);
          selectedBotsFeatureCollection.push(feature);
        } else {
          feature.set('selected', false);
        }
      }
    });
    if (selectedBotsFeatureCollection.getLength() > 0) {
      this.openBotsDrawer();
    }
    this.setState({ selectedBotsFeatureCollection });
    map.render();
  }

  isBotSelected(bot_id) {
    const { selectedBotsFeatureCollection } = this.state;
    for (let i = 0; i < selectedBotsFeatureCollection.getLength(); i += 1) {
      if (selectedBotsFeatureCollection.item(i).getId() === bot_id) {
        return true;
      }
    }
    return false;
  }

  zoomToBot(id, firstMove = false) {
    const { botExtents } = this.state;
    this.fit(botExtents[id], { duration: 100 }, false, firstMove);
  }

  trackBot(id) {
    const { trackingTarget } = this.state;
    if (id === trackingTarget) return;
    this.setState({ trackingTarget: id });
    if (id === 'all') {
      this.zoomToAll(true);
      info('Following all');
    } else if (id === 'pod') {
      this.zoomToAllBots(true);
      info('Following pod');
    } else if (id === 'user') {
      if (this.clientLocation.isValid) {
        const { heading, position } = this.clientLocation;
        this.centerOn(position, false, true);
        if (!Number.isNaN(heading)) {
          map.getView().setRotation(heading);
        }
        info('Following you');
      } else {
        this.trackBot('');
      }
    } else if (id !== '') {
      this.zoomToBot(id, true);
      info(`Following bot ${id}`);
    } else if (trackingTarget === 'all') {
      info('Stopped following all');
    } else if (trackingTarget === 'pod') {
      info('Stopped following pod');
    } else if (trackingTarget === 'user') {
      info('Stopped following you');
    } else {
      info(`Stopped following bot ${trackingTarget}`);
    }
  }

  sendStop() {
    console.log('STOP')
    this.sna.allStop()
  }

  openBotsDrawer() {
    $('#botsDrawer').show('blind', { direction: 'up' });
    this.setState({ botsDrawerOpen: true });
  }

  closeBotsDrawer() {
    $('#botsDrawer').hide('blind', { direction: 'up' });
    this.setState({ botsDrawerOpen: false });
  }

  static formatLength(line) {
    const length = OlGetLength(line, { projection: mercator });
    if (length > 100) {
      return `${Math.round((length / 1000) * 100) / 100} km`;
    }
    return `${Math.round(length * 100) / 100} m`;
  }

  // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // eslint-disable-next-line class-methods-use-this

  render() {
    const {
      selectedBotsFeatureCollection,
      botsLayerCollection,
      trackingTarget,
      faultCounts,
      botsDrawerOpen,
      measureActive,
    } = this.state;


    return (
      <div id="axui_container">
        <div id="leftSidebar" className="column-left">
          <div id="leftPanelsContainer" className="panelsContainerVertical">
            <div className="panel">
              JaiaBot Central Command<br />
              Version 1.1.0
            </div>
            <div className="panel">
              <button type="button" onClick={function() { location.reload() } }>
                Reload Central Command
              </button>
            </div>

          </div>
          <div id="sidebarResizeHandle" className="ui-resizable-handle ui-resizable-e">
            <FontAwesomeIcon icon={faGripVertical} />
          </div>
        </div>
        {/* End of left sidebar */}

        <div id={this.mapDivId} className="map-control" />

        <div id="mapLayers" />

        <div id="eStop">
          <button type="button" style={{"backgroundColor":"red"}} onClick={this.sendStop.bind(this)} title="Stop All">
            STOP
          </button>
        </div>

        <div id="viewControls">
          <button
            type="button"
            id="mapLayersButton"
            onClick={() => {
              $('#mapLayers').toggle('blind', { direction: 'right' });
              $('#mapLayersButton').toggleClass('active');
            }}
          >
            <FontAwesomeIcon icon={faLayerGroup} />
          </button>
          {measureActive ? (
            <div>
              <div id="measureResult" />
              <button
                type="button"
                className="active"
                onClick={() => {
                  // this.measureInteraction.finishDrawing();
                  this.changeInteraction();
                  this.setState({ measureActive: false });
                }}
              >
                <FontAwesomeIcon icon={faRuler} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                this.setState({ measureActive: true });
                this.changeInteraction(this.measureInteraction, 'crosshair');
                info('Touch map to set first measure point');
              }}
            >
              <FontAwesomeIcon icon={faRuler} />
            </button>
          )}
          {trackingTarget === 'all' ? (
            <button type="button" onClick={this.trackBot.bind(this, '')} title="Unfollow All" className="active">
              <FontAwesomeIcon icon={faMapMarkedAlt} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                this.zoomToAll(true);
                this.trackBot('all');
              }}
              title="Follow All"
            >
              <FontAwesomeIcon icon={faMapMarkedAlt} />
            </button>
          )}
          {trackingTarget === 'pod' ? (
            <button type="button" onClick={this.trackBot.bind(this, '')} title="Unfollow Pod" className="active">
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                this.zoomToAllBots(true);
                this.trackBot('pod');
              }}
              title="Follow Pod"
            >
              <FontAwesomeIcon icon={faMapMarkerAlt} />
            </button>
          )}
          {trackingTarget === 'user' ? (
            <button type="button" onClick={this.trackBot.bind(this, '')} title="Unfollow User" className="active">
              <FontAwesomeIcon icon={faCrosshairs} />
            </button>
          ) : (
            <div>
              {this.clientLocation.isValid ? (
                <button
                  type="button"
                  onClick={() => {
                    this.trackBot('user');
                  }}
                  title="Follow User"
                >
                  <FontAwesomeIcon icon={faCrosshairs} />
                </button>
              ) : (
                <button type="button" className="inactive" title="Follow User">
                  <FontAwesomeIcon icon={faCrosshairs} />
                </button>
              )}
            </div>
          )}
        </div>

        <div
          id="botsSummary"
          onClick={botsDrawerOpen ? this.closeBotsDrawer.bind(this) : this.openBotsDrawer.bind(this)}
        >
          <h2>
            <FontAwesomeIcon icon={faMapMarkerAlt} />
          </h2>
          <div id="faultCounts">
            <span id="faultLevel0Count" title="Count of bots with no issues">
              {faultCounts.faultLevel0Count}
            </span>
            <span id="faultLevel1Count" title="Count of bots with warnings">
              {faultCounts.faultLevel1Count}
            </span>
            <span id="faultLevel2Count" title="Count of bots with errors">
              {faultCounts.faultLevel2Count}
            </span>
          </div>
          {trackingTarget
          && trackingTarget !== ''
          && trackingTarget !== 'all'
          && trackingTarget !== 'pod'
          && trackingTarget !== 'user' ? (
            <button type="button" onClick={this.trackBot.bind(this, '')} className="active-track" title="Unfollow">
              <FontAwesomeIcon icon={faMapPin} />
              {trackingTarget.toString()}
            </button>
            ) : (
              ''
            )}
          {botsDrawerOpen ? (
            <button
              type="button"
              id="toggleBotsDrawer"
              className="not-a-button"
              onClick={this.closeBotsDrawer.bind(this)}
              title="Close Pod Drawer"
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
          ) : (
            <button
              type="button"
              id="toggleBotsDrawer"
              className="not-a-button"
              onClick={this.openBotsDrawer.bind(this)}
              title="Open Pod Drawer"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
          )}
        </div>

        <div id="botsDrawer">
          <div id="botsList">
            {botsLayerCollection
              ? botsLayerCollection.getArray().map((layer) => {
                const feature = layer.getSource().getFeatureById(layer.bot_id);
                return (
                  <div
                    key={feature.getId()}
                    onClick={
                        this.isBotSelected(feature.getId())
                          ? this.selectBots.bind(this, [])
                          : this.selectBot.bind(this, feature.getId())
                      }
                    className={`bot-item faultLevel${feature.get('faultLevel')} ${
                      this.isBotSelected(feature.getId()) ? 'selected' : ''
                    }${
                      trackingTarget && feature.getId() === trackingTarget ? ' tracked' : ''
                    }`}
                  >
                    {feature.getId()}
                  </div>
                );
              })
              : ''}
          </div>

          <div id="botDetailsBox">
            {selectedBotsFeatureCollection && selectedBotsFeatureCollection.getLength() > 0
              ? selectedBotsFeatureCollection.getArray().map(feature => (
                <div
                  key={feature.getId()}
                  className=''
                >
                  {BotDetailsComponent(this.podStatus?.bots?.[feature.getId()])}
                  <div id="botContextCommandBox">
                    {/* Leader-based commands and manual control go here */}
                      <button
                        type="button"
                        className=""
                        title="Control Bot"
                      >
                        <FontAwesomeIcon icon={faDharmachakra} />
                      </button>
                    {trackingTarget === feature.getId() ? (
                      <button
                        type="button"
                        onClick={this.trackBot.bind(this, '')}
                        title="Unfollow Bot"
                        className="toggle-active active-track"
                      >
                        <FontAwesomeIcon icon={faMapPin} />
                      </button>
                    ) : (
                      <span>
                        <button
                          type="button"
                          onClick={this.trackBot.bind(this, feature.getId())}
                          title="Follow Bot"
                          className="toggle-inactive"
                        >
                          <FontAwesomeIcon icon={faMapPin} />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              ))
              : ''}
              
          </div>
        </div>

        <div id="commandsDrawer">
          <div id="globalCommandBox">
            <button type="button" className="globalCommand" title="Run Mission" onClick={this.runMissionClicked.bind(this)}>
              <Icon path={mdiPlay} title="Run Mission"/>
            </button>
            <button type="button" className="globalCommand" title="Run Home" onClick={this.runHardcodedMissionClicked.bind(this, 0)}>
              Home
            </button>
            <button type="button" className="globalCommand" title="Run Mission 1" onClick={this.runHardcodedMissionClicked.bind(this, 1)}>
              M 1
            </button>
            <button type="button" className="globalCommand" title="Run Mission 2" onClick={this.runHardcodedMissionClicked.bind(this, 2)}>
              M 2
            </button>
            <button type="button" className="globalCommand" title="Run Mission 3" onClick={this.runHardcodedMissionClicked.bind(this, 3)}>
              M 3
            </button>
            <button type="button" className="globalCommand" title="Run Home" onClick={this.runHardcodedMissionClicked.bind(this, 4)}>
              D Home
            </button>
            <button type="button" className="globalCommand" title="Run Mission 1" onClick={this.runHardcodedMissionClicked.bind(this, 5)}>
              D 1
            </button>
            <button type="button" className="globalCommand" title="Run Mission 2" onClick={this.runHardcodedMissionClicked.bind(this, 6)}>
              D 2
            </button>
            <button type="button" className="globalCommand" title="Run Mission 3" onClick={this.runHardcodedMissionClicked.bind(this, 7)}>
              D 3
            </button>
            <button type="button" className="globalCommand" title="Clear Mission" onClick={this.clearMissionClicked.bind(this)}>
              <Icon path={mdiDelete} title="Clear Mission"/>
            </button>
          </div>
        </div>

      </div>
    );
  }

  didClickMap(evt) {
    var lonlat = mercator_to_equirectangular(evt.coordinate)
    var lon = lonlat[0]
    var lat = lonlat[1]

    let botId = 0

    if (!(botId in this.missions)) {
      this.missions[botId] = {
        botId: botId,
        time: '1642891753471247',
        type: 'MISSION_PLAN',
        plan: {
          start: 'START_IMMEDIATELY',
          movement: 'TRANSIT',
          goal: [],
          recovery: {recoverAtFinalGoal: true}
        }
      }
    }

    this.missions[botId].plan.goal.push({location: {lon: lon, lat: lat}})

    this.updateMissionLayer()
  }

  updateMissionLayer() {
    // Update the mission layer
    let features = []

    let goals = this.missions?.[0]?.plan?.goal || []

    let transformed_pts = goals.map(goal => {
      return equirectangular_to_mercator([goal.location.lon, goal.location.lat])
    })

    for (let pt of transformed_pts) {
      features.push(new OlFeature({ geometry: new OlPoint(pt) }))
    }

    features.push(new OlFeature({ geometry: new OlLineString(transformed_pts), name: "Bot Path" }))

    var vectorSource = new OlVectorSource({
        features: features
    })

    const styles = [
      new OlStyle({
        image: new OlCircleStyle({
          fill: new OlFillStyle({color: '#5ec957'}),
          stroke: new OlStrokeStyle({color: '#cfffd2'}),
          radius: 10,
        }),
        fill: new OlFillStyle({color: '#5ec957'}),
        stroke: new OlStrokeStyle({color: '#5ec957', width: 2.5}),
      }),
    ];

    this.missionLayer.setStyle(styles)

    this.missionLayer.setSource(vectorSource)
  }

  sendMissionCommand(botId) {
    // Issue command
    if (!(botId in this.missions)) {
      console.log("No mission data for bot " + botId + "!")
      return
    }

    this.sna.postCommand(this.missions[botId])
  }

  runMissionClicked() {
    this.sendMissionCommand(0)
  }

  runHardcodedMissionClicked(index) {
    this.sna.postCommand(missions[index])

    // Add waypoint markers
    this.missions[0] = missions[index]
    this.updateMissionLayer()
  }

  clearMissionClicked() {
    delete this.missions[0]
    this.updateMissionLayer()
  }
}

// =================================================================================================
