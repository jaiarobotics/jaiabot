/* eslint-disable react/jsx-no-bind */
/* eslint-disable react/self-closing-comp */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/sort-comp */
/* eslint-disable react/no-danger */
/* eslint-disable max-len */
/* eslint-disable react/no-unused-state */
/* eslint-disable no-unused-vars */
/* eslint-disable react/no-multi-comp */

import React from 'react';

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
import OlTileImage from 'ol/source/TileImage';
import OlTileWMS from 'ol/source/TileWMS';
import OlTileJSON from 'ol/source/TileJSON';
import OlTileGrid from 'ol/tilegrid/TileGrid';
import OlWMTS, { optionsFromCapabilities as OlOptionsFromWMTSCapabilities } from 'ol/source/WMTS';
import OlWMTSCapabilities from 'ol/format/WMTSCapabilities';
import OlTileArcGISRest from 'ol/source/TileArcGISRest';
import { click, altKeyOnly } from 'ol/events/condition';
import OlSelect from 'ol/interaction/Select';
import { createEmpty as OlCreateEmptyExtent, extend as OlExtendExtent } from 'ol/extent';
import OlZoomSlider from 'ol/control/ZoomSlider';
import OlScaleLine from 'ol/control/ScaleLine';
import OlMousePosition from 'ol/control/MousePosition';
import OlZoom from 'ol/control/Zoom';
import OlRotate from 'ol/control/Rotate';
import { createStringXY as OlCreateStringXY } from 'ol/coordinate';
import OlGeolocation from 'ol/Geolocation';
import { unByKey as OlUnobserveByKey } from 'ol/Observable';
import OlOverlay from 'ol/Overlay';
import { getArea as OlGetArea, getLength as OlGetLength } from 'ol/sphere';
import { LineString as OlLineString, Polygon as OlPolygon } from 'ol/geom';
import OlDrawInteraction from 'ol/interaction/Draw';
import {
  Circle as OlCircleStyle, Fill as OlFillStyle, Stroke as OlStrokeStyle, Style as OlStyle
} from 'ol/style';
import OlLayerSwitcher from 'ol-layerswitcher';
import OlBingMaps from 'ol/source/BingMaps';
import OlGraticule from 'ol/Graticule';
import OlStroke from 'ol/style/Stroke';
import OlAttribution from 'ol/control/Attribution';
import { fromLonLat, getTransform } from 'ol/proj';

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

import dateFormat from 'dateformat';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretLeft,
  faGripVertical,
  faExpand,
  faVolumeUp,
  faWindowClose,
  faLocationArrow,
  faCrosshairs,
  faTimes,
  faChevronDown,
  faChevronLeft,
  faChevronUp,
  faDharmachakra,
  faDirections,
  faMapMarkerAlt,
  faMapPin,
  faMapMarkedAlt,
  faPlay,
  faPlayCircle,
  faRoute,
  faRuler,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';

import cmdIconStop from '../icons/Stop.png';

import cmdIconBeep from '../icons/other_commands/beep.png';
// import cmdIconDefault from '../icons/other_commands/default.png';
import cmdIconDive from '../icons/other_commands/dive.png';
import cmdIconDiveBottom from '../icons/other_commands/DiveBottom.png';
import cmdIconDiveDefault from '../icons/other_commands/DiveDefault.png';
import cmdIconDiveDrift from '../icons/other_commands/DiveDrift.png';
import cmdIconDiveProfile from '../icons/other_commands/DiveProfile.png';
import cmdIconJump from '../icons/other_commands/Jump1.png';
import cmdIconRTH from '../icons/other_commands/rth.png';
import cmdIconLineData from '../icons/other_commands/SurfaceData.png';
import cmdIconOverrideOOW from '../icons/other_commands/OverrideOOW.png';
import cmdIconLED from '../icons/other_commands/LED.png';

// const element = <FontAwesomeIcon icon={faCoffee} />

import {BotDetailsComponent} from './BotDetails'
import AssetInfo from './AssetInfo';
import AssetControl from './AssetControl';
import PodControl from './PodControl';
import JaiaAPI from '../../common/JaiaAPI';
import GeoEdit from './GeoEdit';
import LayerEditControls from './LayerEditControls';
import FeaturePropertiesEditor from './FeaturePropertiesEditor';
import FileManager from './FileManager';
import MissionEditor from './MissionEditor';
import MissionControl from './MissionControl';
import CommandEditor from './CommandEditor';

import shapes from '../libs/shapes';
import tooltips from '../libs/tooltips';
import FormationOriginMarker from '../libs/FormationOriginMarker';
import SurveyMarker from '../libs/RectangleSurveyMarker';
import HeadingControlMarker from '../libs/HeadingControlMarker';
import JsonAPI from '../../common/JsonAPI';

// jQuery UI touch punch
import punchJQuery from '../libs/jquery.ui.touch-punch';
import jqueryDrawer from '../libs/jquery.drawer';

import {
  error, success, warning, info, debug, messageLog
} from '../libs/notifications';

// Don't use any third party css exept reset-css!
import 'reset-css';
// import 'ol-layerswitcher/src/ol-layerswitcher.css';
import '../style/AXUI.less';

// Must prefix less-vars-loader with ! to disable less-loader, otherwise less-vars-loader will get JS (less-loader
// output) as input instead of the less.
// eslint-disable-next-line import/no-webpack-loader-syntax, import/no-unresolved
const lessVars = require('!less-vars-loader?camelCase,resolveVariables!../style/AXUI.less');

const COLOR_CONTROL_DEFAULT = lessVars.buttonColor;
const COLOR_SELECTED = lessVars.selectedColor;
const COLOR_INACTIVE = lessVars.inactiveColor;
const COLOR_MEASURE_DRIFT = lessVars.driftingColor;
const COLOR_UNDERWATER = lessVars.underwaterColor;
const COLOR_CONTROLLED = lessVars.controlledColor;
const COLOR_TRACKED = lessVars.trackedColor;
const COLOR_STATUS_GOOD = lessVars.goodColor;
const COLOR_STATUS_WARNING = lessVars.warningColor;
const COLOR_STATUS_ERROR = lessVars.errorColor;
const COLOR_MISSION_DEFAULT = lessVars.missionColor;
const COLOR_GOAL = lessVars.missionGoalColor;

punchJQuery($);
// jqueryDrawer($);

const { getBoatStyle } = shapes;
const { getWaypointStyle } = shapes;
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
const waypointDefaultProperties = new Map([['Depth', '0'], ['Notes', '']]);


const ACCEL_PROFILE = [[0, 20], [3000, 30], [5000, 70]];

// Cookies to save visible map layers

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + (exdays*24*60*60*1000));
  var expires = "expires="+ d.toUTCString();
  document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
  var name = cname + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

function saveVisibleLayers() {
  setCookie("visibleLayers", Array.from(visibleLayers).join(","), 365)
}

var visibleLayers = new Set()

function loadVisibleLayers() {
  let cookie = getCookie("visibleLayers")

  if (cookie == "") {
    visibleLayers = new Set([
      "OpenStreetMap"
    ])
  }
  else {
    visibleLayers = new Set(cookie.split(','))
  }
}

function makeLayerSavable(layer) {
  let title = layer.get("title")

  // Set visible if it should be
  let visible = visibleLayers.has(title)
  layer.set("visible", visible)

  // Catch change in visible state
  layer.on("change:visible", (event) => {
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

    // Hope this doesn't collide. Pretty unlikely.
    this.clientId = Math.floor(Math.random() * Math.floor(2 ** 15));

    this.mapDivId = `map-${Math.round(Math.random() * 100000000)}`;

    this.jaiaAPIUrl = '/jaia';
    // this.jaiaAPIUrl = 'http://192.168.42.1:5000/jaia';

    this.sna = new JaiaAPI(this.jaiaAPIUrl, this.clientId, false);
    this.missionExecutionAPI = JsonAPI('/mission');

    this.mapTilesAPI = JsonAPI('/tiles');

    //not used yet
    this.modes = {
      plan: 'Plan',
      exec: 'Execute',
      data: 'Analyze'
    };

    const localScratchSource = new OlVectorSource({});

    this.missions = {}

    this.state = {
      error: {},
      debugMode: process.env.NODE_ENV === 'development',
      // User interaction modes
      mode: 'exec',
      currentInteraction: null,
      mapZoomLevel: 14,
      controlRecipient: null,
      controlSpeed: 0,
      controlHeading: 0,
      accelerationProfileIndex: 0,
      manualControlStatus: 3, // 3 = unselected (default), 2 = failed to select, 1 = selecting, 0 = selected
      manualControlTabletID: 0,
      manualControlTarget: 4294967295, // Defaults to MAX_INT_32, or signed -1 cast to unsigned

      // not used anymore
      panelsVisibility: {
        assetListContainer: false,
        layerTreeContainer: false,
        toolboxContainer: false,
        selectionInfoContainer: false,
        assetControlContainer: false,
        podControlContainer: false,
        geoEditContainer: false,
        missionEditContainer: false,
        missionExecutionContainer: false
      },

      missionDrawerOpen: false,
      botsDrawerOpen: false,
      commandDrawerOpen: false,
      // Map layers
      botsLayerCollection: new OlCollection([], { unique: true }),
      poiLayerCollection: new OlCollection([], { unique: true }),
      dataLayerCollection: new OlCollection([], { unique: true }), // not used yet
      chartLayerCollection: new OlCollection([], { unique: true }),
      baseLayerCollection: new OlCollection([], { unique: true }),
      selectedBotsFeatureCollection: new OlCollection([], { unique: true }),
      headingControlMarkerLayerCollection: new OlCollection([], { unique: true }),
      headingControlMarker: null,
      liveCommand: {
        type: '',
        parameters: [],
        formationParameters: [0, 0, 0, 10]
      },
      testSurveyMarkerLayerCollection: new OlCollection([], { unique: true }),
      testSurveyMarker: null,
      // incoming data
      rawBotData: {},
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
      activeEditFile: '',
      activeEditLayer: null,
      activeEditWaypoint: null,
      activeFileIsDirty: false,
      activeEditMissionPlan: {
        name: '',
        data: null,
        isDirty: false,
        isVisible: false,
        activeEditMissionAction: null
      },
      missionPlanData: new Map(),
      missionManagerMode: 'closed',
      missionExecutionState: {
        planName: '',
        missionPlan: null,
        isActive: false,
        isExecuting: false,
        missionSegment: -1,
        error: null,
        lastAction: null
      },
      selectedMissionAction: -1,
      measureFeature: null,
      measureActive: false
    };

    this.missionPlanMarkers = new Map();
    this.missionPlanMarkerExtents = new Map();
    this.planLayerCollection = new OlCollection([], { unique: true });

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

    const addChartLayerWMTS = (wmtsOpts, collection) => {
      const parser = new OlWMTSCapabilities();
      fetch(wmtsOpts.url)
        .then(response => response.text())
        .then((text) => {
          const result = parser.read(text);
          const options = OlOptionsFromWMTSCapabilities(result, {
            layer: wmtsOpts.layer,
            matrixSet: wmtsOpts.tileMatrixSet,
            attributions: wmtsOpts.attributions || ''
          });
          // options.maxZoom = wmtsOpts.maxZoom || 19;
          var layer = new OlTileLayer({
              title: wmtsOpts.title,
              type: wmtsOpts.type || '',
              opacity: 1,
              source: new OlWMTS(options),
              visible: wmtsOpts.type === 'base',
              preload: Infinity
            })
          makeLayerSavable(layer)

          collection.push(layer)
        });
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
        title: 'Google Satellite & Roads',
        type: 'base',
        source: new OlSourceXYZ({ url: 'http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' }),
//         tileGrid: new OlTileGrid({origin: [45, 45]})
      }),
      new OlTileLayer({
        title: 'OpenStreetMap',
        type: 'base',
        source: new OlSourceOsm()
      }),
      // Data details: https://www.ngdc.noaa.gov/mgg/global/global.html
      // Visualization details: https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/etopo1_hillshade/MapServer
      new OlTileLayer({
        title: 'NOAA ETOPO1 Global Relief Model Hillshade',
        type: 'base',
        source: new OlTileWMS({
          url: 'https://gis.ngdc.noaa.gov/arcgis/services/web_mercator/etopo1_hillshade/MapServer/WmsServer',
          attributions: 'NOAA National Centers for Environmental Information (NCEI)',
          params: {
            LAYERS: '0',
            TILED: true
          }
        })
      }),
      new OlTileLayer({
        // See https://gis.ngdc.noaa.gov/arcgis/rest/services/EMAG2v3/MapServer for legend
        // See https://www.ngdc.noaa.gov/geomag/emag2.html for more info
        title: 'NOAA EMAG2 (Earth Magnetic Anomaly Grid 2-minute) (v3)',
        type: 'base',
        source: new OlTileWMS({
          url: 'https://gis.ngdc.noaa.gov/arcgis/services/EMAG2v3/MapServer/WmsServer',
          attributions: 'NOAA National Centers for Environmental Information (NCEI)',
          params: {
            LAYERS: '4,7,8',
            TILED: true
          }
        })
      }),
      new OlTileLayer({
        // https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/gebco_2014_hillshade/MapServer
        title: 'NOAA GEBCO (General Bathymetric Chart of the Oceans) 2014 Hillshade',
        type: 'base',
        source: new OlTileWMS({
          url: 'https://gis.ngdc.noaa.gov/arcgis/services/web_mercator/gebco_2014_hillshade/MapServer/WmsServer',
          attributions:
            'General Bathymetric Chart of the Oceans (GEBCO); NOAA National Centers for Environmental Information (NCEI); Natural Earth',
          params: {
            LAYERS: '0',
            TILED: true
          }
        })
      }),
    ].forEach((layer) => {
      makeLayerSavable(layer);
      baseLayerCollection.push(layer);
    });


    [
      new OlTileLayer({
        // https://gis.ngdc.noaa.gov/arcgis/rest/services/web_mercator/seafloor_age/MapServer
        title: 'NOAA Seafloor Age (mYa) (online only)',
        visible: false,
        source: new OlTileWMS({
          url: 'https://gis.ngdc.noaa.gov/arcgis/services/web_mercator/seafloor_age/MapServer/WmsServer',
          attributions: 'Muller et al (2008); NOAA National Centers for Environmental Information (NCEI)',
          params: {
            LAYERS: '0,1,2,3',
            TILED: true
          }
        })
      }),
      new OlTileLayer({
        // https://gis.ngdc.noaa.gov/arcgis/rest/services/reference/world_countries_overlay/MapServer
        title: 'NOAA World Countries Overlay (online only)',
        visible: false,
        source: new OlTileArcGISRest({
          url: 'https://gis.ngdc.noaa.gov/arcgis/rest/services/reference/world_countries_overlay/MapServer',
          attributions: 'Esri, Garmin, CIA Factbook',
          crossOrigin: 'anonymous',
          projection: 'ESPG:3857',
          params: {
            // Don't specify f here
            layers: 'show:0,1,2' // 0 = detailed, 1 = generalized, 2 = labels
          }
        })
      })
    ].forEach((layer) => {
      makeLayerSavable(layer)
      chartLayerCollection.push(layer);
    });

    addChartLayerWMTS(
      {
        title: 'NOAA Bathymetry Hillshades (online only)',
        url:
          'https://gis.ngdc.noaa.gov/arcgis/rest/services/bag_hillshades/ImageServer/WMTS/1.0.0/WMTSCapabilities.xml',
        layer: 'bag_hillshades',
        tileMatrixSet: 'default028mm'
      },
      chartLayerCollection
    );

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
      dataLayerCollection,
      poiLayerCollection,
      testSurveyMarkerLayerCollection,
      headingControlMarkerLayerCollection,
      selectedBotsFeatureCollection,
      mapZoomLevel,
      measureFeature
    } = this.state;

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
          (response) => {},
          (failReason) => {
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

    /*
      Default interactions:
        - Click on bot - select bot + show info
        - Click on POI - select POI + show info
        - Click on origin - select origin + show handles + info
        - Double click on map - zoom in
        - Double click on Marker - zoom to?
        - Right click / long press on bot - Context menu for control/track
        - Right click / long press on POI - edit POI?
        - Right click / long press on map - set origin?
        - Ctrl+click+drag - group rect. select
      Other Interactions:
        - Click to select location for origin
        - Click to select location for POI
        - Click to select location for formation
        - Click+drag on origin - move origin
        - Click+drag on origin vector - move vector end
    */

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

    /*
    this.selectAltClick = new OlSelect({
      condition: function altClickCondition(mapBrowserEvent) {
        return click(mapBrowserEvent) && altKeyOnly(mapBrowserEvent);
      }
    });
    */

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

        /** @type {module:ol/coordinate~Coordinate|undefined} */
        const tooltipCoord = evt.coordinate;

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

    this.setActiveEditFile = this.setActiveEditFile.bind(this);
    this.setActiveEditLayer = this.setActiveEditLayer.bind(this);
    this.setActiveEditWaypoint = this.setActiveEditWaypoint.bind(this);
    this.setActiveFileDirty = this.setActiveFileDirty.bind(this);

    this.setControlRecipient = this.setControlRecipient.bind(this);
    this.unsetControlRecipient = this.unsetControlRecipient.bind(this);
    this.setViewport = this.setViewport.bind(this);
    this.centerOn = this.centerOn.bind(this);
    this.fit = this.fit.bind(this);

    this.loadMissionPlanData = this.loadMissionPlanData.bind(this);
    this.setMissionPlanFileDirty = this.setMissionPlanFileDirty.bind(this);
    this.setMissionPlanFileLocked = this.setMissionPlanFileLocked.bind(this);
    this.setMissionPlanVisibility = this.setMissionPlanVisibility.bind(this);
    this.setActiveEditMissionPlan = this.setActiveEditMissionPlan.bind(this);
    this.zoomToMissionPlanExtent = this.zoomToMissionPlanExtent.bind(this);
    this.setMissionManagerMode = this.setMissionManagerMode.bind(this);

    this.sendCommand = this.sendCommand.bind(this);
    this.sendStop = this.sendStop.bind(this);
    this.startMission = this.startMission.bind(this);
    this.skipToNextMissionAction = this.skipToNextMissionAction.bind(this);

    this.setSelectedMissionAction = this.setSelectedMissionAction.bind(this);

    this.updateAcceleration = this.updateAcceleration.bind(this);


    // Read the zoomLevel
    let zoomLevel = getCookie("zoomLevel")
    if (zoomLevel != "") {
      map.getView().setZoom(zoomLevel)
    }

    // On Zoom, save the zoomLevel
    map.getView().on('change:resolution', function() {
      let zoomLevel = map.getView().getZoom()
      setCookie("zoomLevel", zoomLevel)
    })

    // Read the rotation
    let rotation = getCookie("rotation")
    if (rotation != "") {
      map.getView().setRotation(rotation)
    }

    // On rotation change, save the rotation
    map.getView().on('change:rotation', function() {
      let rotation = map.getView().getRotation()
      setCookie("rotation", rotation)
    })

  }

  createLayers() {
    this.missionLayer = new OlVectorLayer()
  
    console.log(this.state.baseLayerCollection)

    let layers = [
      new OlLayerGroup({
        title: 'Base Maps (internet connection required)',
        fold: 'open',
        layers: this.state.baseLayerCollection
      }),
      this.chartLayerGroup,
      new OlLayerGroup({
        // title: 'Plans',
        // fold: 'open',
        layers: this.planLayerCollection
      }),
      new OlLayerGroup({
        // title: 'Data',
        // fold: 'open',
        layers: this.state.dataLayerCollection
      }),
      new OlLayerGroup({
        // title: 'Points of Interest',
        // fold: 'open',
        layers: this.state.poiLayerCollection
      }),
      this.botsLayerGroup,
      this.clientPositionLayer,
      this.measureLayer,
      this.missionLayer,
      new OlLayerGroup({
        name: 'Debug SurveyMarker',
        layers: this.state.testSurveyMarkerLayerCollection
      }),
      new OlLayerGroup({
        name: 'Heading Control',
        layers: this.state.headingControlMarkerLayerCollection
      })
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

    const { debugMode } = this.state;
    if (debugMode) {
      warning("Running in debug mode!");
    }

		this.timerID = setInterval(() => this.pollPodStatus(), 2500);
		this.missionStatusTimer = setInterval(() => this.pollMissionStatus(), 2500);

    $('#leftSidebar').resizable({
      containment: 'parent',
      handles: null,
      maxWidth: sidebarMaxWidth,
      minWidth: sidebarMinWidth,
      resize(event, ui) {
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
    const { panelsVisibility } = this.state;

    Object.keys(panelsVisibility).forEach((id) => {
      if (!panelsVisibility[id]) {
        $(`#${id}`).hide('blind', {}, 500);
      }
    });
    */

    const { headingControlMarkerLayerCollection } = this.state;
    const headingControlMarker = new HeadingControlMarker(
      'Manual Control',
      map,
      headingControlMarkerLayerCollection,
      (heading) => {
        const { controlRecipient } = us.state;
        if (controlRecipient) {
          us.sendHeading(Math.round(heading));
        } else {
          console.error('Controlling heading of null bot');
        }
      },
      (distance) => {
        // Do nothing
      },
      COLOR_CONTROLLED
    );

    /*
        This needs to be called whenever liveCommand is updated externally, but NOT in the render method
        */
    headingControlMarker.create(0, 0, 0, 10);
    headingControlMarker.disableEdit();
    headingControlMarker.hide();

    this.setState({ headingControlMarker });

    const { controlSpeed } = this.state;
    $('#speedSlider').slider({
      max: 100,
      min: 0,
      orientation: 'horizontal',
      value: controlSpeed,
      slide(event, ui) {
        us.sendThrottle(ui.value);
      }
    });


    const { testSurveyMarkerLayerCollection } = this.state;
      /*
    id,
    map,
    layerCollection,
    numBots,
    positionCallback,
    sizeCallback,
    rotationCallback,
    fillColor = '#2073BA',
    onClick = null
      */
    const testSurveyMarker = new SurveyMarker(
      'Debug Survey',
      map,
      testSurveyMarkerLayerCollection,
      10,
      (marker) => {
      },
      COLOR_CONTROLLED,
      (click) => {

      }
    );
    this.setState({ testSurveyMarker });

    OlLayerSwitcher.renderPanel(map, document.getElementById('mapLayers'));
    // $('input').checkboxradio();

    $('button').disableSelection();

    tooltips();

    $('#botsDrawer').hide('blind', { direction: 'up' }, 2000);
    $('#missionDrawer').hide('blind', { direction: 'up' }, 2000);
    $('#commandsDrawer').hide('blind', { direction: 'down' }, 2000);
    $('#mapLayers').hide('blind', { direction: 'right' }, 2000);

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
    clearInterval(this.missionStatusTimer);
    clearTimeout(this.accelTimer);
    const { controlRecipient } = this.state;
    if (controlRecipient) {
      // TODO - test
      this.sendThrottle(0);
      this.unsetControlRecipient();
    }
  }

	toggleDebugMode() {
		const { debugMode } = this.state;
		this.setState({ debugMode: !debugMode }, () => {
			const { debugMode } = this.state;
			if (debugMode) {
				error("Running in debug mode!");
			} else {
				error("Exited debug mode!");
			}
		});
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

  unsetControlRecipient() {
    const { controlRecipient } = this.state;

    if (controlRecipient) {
      return this.sna.setControlId(parseInt(controlRecipient.getId(), 10) || -1, 0).then(
        (result) => {
          if (!result) {
            return Promise.reject(new Error('Error from setManualID'));
          }
          if (result.code === 0) {
            controlRecipient.setStyle(getBoatStyle(map));
            const { headingControlMarker } = this.state;
            headingControlMarker.disableEdit();
            headingControlMarker.hide();
            this.setState({ controlRecipient: null, headingControlMarker, controlSpeed: 0 });
            this.trackBot('');
            return Promise.resolve();
          }
          return Promise.reject(new Error(`Error from setManualID: Code ${result.code} ${result.msg}`));
        },
        failReason => Promise.reject(new Error(failReason))
      );
    }
    return Promise.resolve();
  }

  setControlRecipient(recipient, startControl = true) {
    const { controlRecipient } = this.state;
    // Don't do anything if the object hasn't changed
    if (recipient === controlRecipient) return;
    // Not changing ID but have a new feature object
    if (!startControl || (controlRecipient && recipient && controlRecipient.getId() === recipient.getId())) {
      recipient.setStyle(getBoatStyle(map, COLOR_CONTROLLED));
      this.setState({ controlRecipient: recipient });
      return;
    }
    // New one is different, un-control old one
    this.unsetControlRecipient()
      // Request control from hub
      .then(
        () => {
          this.sna.setControlId(parseInt(recipient.getId(), 10) || -1, 1).then(
            (result) => {
              if (!result) {
                console.error('Error from setManualID');
                error('Unable to control bot.');
              } else if (result.code === 0) {
                recipient.setStyle(getBoatStyle(map, COLOR_CONTROLLED));
                const { headingControlMarker } = this.state;
                headingControlMarker.update(
                  recipient.getGeometry().getCoordinates()[1],
                  recipient.getGeometry().getCoordinates()[0],
                  0
                );
                headingControlMarker.show();
                headingControlMarker.enableEdit();
                this.setState({ controlRecipient: recipient, headingControlMarker });
                info(`Now controlling bot ${recipient.getId()}`);
                this.trackBot(recipient.getId());
              } else {
                console.error(`Error from setManualID: Code ${result.code} ${result.msg}`);
                error('Unable to control bot.');
              }
            },
            (failReason) => {
              console.error(failReason);
              error('Unable to set controlled bot.');
            }
          );
        },
        (failReason) => {
          console.error(failReason);
          error('Unable to release controlled bot.');
        }
      );
  }

  sendManualControl(heading, throttle) {
    return this.sna.sendManualControl(heading, throttle, 0);
  }

  sendHeading(newHeading) {
    // Constrain to 0-360
    let heading = newHeading;
    while (heading < 0) heading += 360;
    while (heading > 360) heading -= 360;
    const { controlSpeed } = this.state;
    this.setState({ controlHeading: heading });
    this.sendManualControl(heading, controlSpeed);
  }

  sendThrottle(throttle) {
    const { controlHeading } = this.state;
    this.setState({ controlSpeed: throttle });
    this.sendManualControl(controlHeading, throttle);
  }

  updateAcceleration() {
    clearTimeout(this.accelTimer);
    const { accelerationProfileIndex } = this.state;
    if (accelerationProfileIndex >= ACCEL_PROFILE.length) {
      return;
    }
    this.sendThrottle(ACCEL_PROFILE[accelerationProfileIndex][1]);
    if (accelerationProfileIndex < ACCEL_PROFILE.length - 1) {
      this.setState({ accelerationProfileIndex: accelerationProfileIndex + 1 });
      this.accelTimer = setTimeout(this.updateAcceleration, ACCEL_PROFILE[accelerationProfileIndex + 1][0]);
    }
  }

  startAcceleration() {
    $('#throttleButtonSingle').addClass('active');
    this.accelTimer = setTimeout(this.updateAcceleration, ACCEL_PROFILE[0][0]);
    this.setState({ accelerationProfileIndex: 0 });
  }

  cancelAcceleration() {
    clearTimeout(this.accelTimer);
    this.sendThrottle(0);
    $('#throttleButtonSingle').removeClass('active');
    this.setState({ accelerationProfileIndex: 0 });
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

  setActiveEditFile(fileName) {
    this.setState({ activeEditFile: fileName });
  }

  setActiveFileDirty(dirty) {
    this.setState({ activeFileIsDirty: dirty });
  }

  setActiveEditLayer(layer) {
    const { activeEditLayer, activeEditWaypoint } = this.state;
    if (activeEditWaypoint) this.setActiveEditWaypoint(null);
    if (activeEditLayer && activeEditLayer !== layer) {
      activeEditLayer.setStyle(getWaypointStyle());
    }
    if (layer) {
      layer.setStyle(getWaypointStyle(COLOR_CONTROLLED));
    } else {
      // If we are leaving edit mode, go back to default interaction
      this.changeInteraction();
    }
    this.setState({ activeEditLayer: layer });
  }

  setActiveEditWaypoint(waypoint) {
    const { activeEditWaypoint } = this.state;
    if (activeEditWaypoint) {
      activeEditWaypoint.setStyle(null);
    }
    if (waypoint) {
      waypoint.setStyle(getWaypointStyle(COLOR_SELECTED));
    }
    this.setState({ activeEditWaypoint: waypoint });
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
    const newZoom = map.getView().getZoomForResolution(newRes);
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
        this.podStatus = result
      }
    )

    this.sna.getOldStatus().then(
      (result) => {
        const { selectedBotsFeatureCollection } = this.state;
        // console.log('Poll result: ');
        // console.log(result);
        if (!Reflect.has(result, 'dialog')) {
          error('Unable to load Pod data!');
          console.error(result);
          this.timerID = setInterval(() => this.pollPodStatus(), 2500);
          return;
        }
        if (!Reflect.has(this, 'prevDialogType')) {
          this.prevDialogType = 0;
        }
        if (result.dialog.dialogType !== this.prevDialogType && result.dialog.dialogType === 1) {
          info(result.dialog.message);
        }
        this.prevDialogType = result.dialog.dialogType;

        this.setState({
          manualControlStatus: result.dialog.manualStatus,
          manualControlTabletID: result.dialog.browser_id,
          manualControlTarget: result.dialog.manual_bot_id
        });
        if (result.dialog.manualStatus === 0 && result.dialog.manual_bot_id && result.dialog.manual_bot_id !== 4294967295) {
          const { controlRecipient } = this.state;
          if (!controlRecipient || result.dialog.manual_bot_id.toString() !== controlRecipient.getId()) {
            const controlRecipientFeature = this.getLiveLayerFromBotId(result.dialog.manual_bot_id.toString())
              .getSource()
              .getFeatureById(result.dialog.manual_bot_id.toString());
            // this.setState({ controlRecipient: controlRecipientFeature });
            this.setControlRecipient(controlRecipientFeature, false);
          }
        }

        if (!Array.isArray(result.bots)) {
          // No bots connected to hub
          return;
        }
        const rawBotData = {};
        result.bots.forEach((bot) => {
          rawBotData[bot.botID.toString()] = bot;
        });
        this.setState({
          rawBotData
        });

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
          const otherState = parseInt(botFeature.get('otherMarker') || 0, 10);

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

          const { controlRecipient } = this.state;

          if (controlRecipient && botFeature.getId() === controlRecipient.getId()) {
            botFeature.set('controlled', true);
            this.setControlRecipient(botFeature);
            const { headingControlMarker, controlHeading } = this.state;

            let bot = this.state.rawBotData[controlRecipient.getId().toString()]

            headingControlMarker.update(
              bot.location.lat,
              bot.location.lon,
              controlHeading
            );
            this.setState({ headingControlMarker });
          }

          if (trackingTarget === bot_id) {
            botFeature.set('tracked', true);
          }

          const { missionExecutionState } = this.state;
          if (missionExecutionState.isActive && Array.isArray(missionExecutionState.botsDoneWithAction)) {
            if (missionExecutionState.botsDoneWithAction.includes(botFeature.getId())) {
              botFeature.set('completed', true);
            }
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
    this.setSelectedMissionAction(-1);
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

  // Can't call this from render() because it renders interactive elements and rendering kills the drag action
  renderMissionPlan(name, missionPlan) {
    const {
      activeEditMissionPlan, activeEditMissionAction, missionExecutionState, selectedMissionAction
    } = this.state;
    const oldMarkers = this.missionPlanMarkers.get(name);
    if (oldMarkers) {
      oldMarkers.forEach((marker) => {
        marker.remove();
      });
    }
    const markers = [];
    const markerExtents = new Map();
    const us = this;
    missionPlan.data.forEach((missionAction, index) => {
      let formationColor = COLOR_MISSION_DEFAULT;
      if (typeof missionPlan.activeSegment !== 'undefined' && missionPlan.activeSegment === index) {
        formationColor = COLOR_GOAL;
      } else if (selectedMissionAction === index) {
        formationColor = COLOR_SELECTED;
      }
      if (missionAction.type === 'formation') {
      // TODO add a new misssionaction type for survey (rectangle survey marker)
        const marker = new FormationOriginMarker(
          `${name} : Action ${index + 1}`,
          missionAction.formationType === '5' ? 'line' : 'circle',
          map,
          this.planLayerCollection,
          (coords) => {
            const { missionPlanData } = us.state;
            // eslint-disable-next-line no-shadow
            const missionPlan = missionPlanData.get(name);
            // eslint-disable-next-line prefer-destructuring
            missionPlan.data[index].formationParameters[0] = Math.round(coords[1] * 1000000) / 1000000.0;
            // eslint-disable-next-line prefer-destructuring
            missionPlan.data[index].formationParameters[1] = Math.round(coords[0] * 1000000) / 1000000.0;
            us.updateMissionPlan(name, missionPlan.data);
          },
          (heading) => {
            const { missionPlanData } = us.state;
            // eslint-disable-next-line no-shadow
            const missionPlan = missionPlanData.get(name);
            missionPlan.data[index].formationParameters[2] = Math.round(heading);
            us.updateMissionPlan(name, missionPlan.data);
          },
          (distance) => {
            const { missionPlanData } = us.state;
            // eslint-disable-next-line no-shadow
            const missionPlan = missionPlanData.get(name);
            missionPlan.data[index].formationParameters[3] = Math.round(distance);
            us.updateMissionPlan(name, missionPlan.data);
          },
          formationColor,
          (event) => {
            us.setSelectedMissionAction(index);
          }
        );
        // Formation params
        // lat, lon, bearing, sep
        if (missionAction.formationParameters) {
          marker.create(      // called on update as well as create
            missionAction.formationParameters[0],
            missionAction.formationParameters[1],
            missionAction.formationParameters[2],
            missionAction.formationParameters[3]
          );
          markerExtents.set(index, marker.getExtent());
        }
        if (missionPlan.isActiveEdit) {
          marker.enableEdit();  //makes it draggable
        }
        markers.push(marker);
      }
    });
    this.missionPlanMarkers.set(name, markers);
    this.missionPlanMarkerExtents.set(name, markerExtents);
    // map.render();
  }

  reRenderMissionPlan() {
    const { missionExecutionState, activeEditMissionPlan } = this.state;
    if (missionExecutionState && missionExecutionState.isActive && missionExecutionState.missionPlan) {
      this.renderMissionPlan(missionExecutionState.planName, {
        data: missionExecutionState.missionPlan,
        activeSegment: missionExecutionState.missionSegment
      });
    } else if (activeEditMissionPlan && activeEditMissionPlan.name !== '') {
      this.renderMissionPlan(activeEditMissionPlan.name, activeEditMissionPlan);
    }
  }

  unRenderMissionPlan(name) {
    const {
      activeEditMissionPlan, activeEditMissionAction, missionExecutionState, selectedMissionAction
    } = this.state;
    const oldMarkers = this.missionPlanMarkers.get(name);
    if (oldMarkers) {
      oldMarkers.forEach((marker) => {
        marker.remove();
      });
    }
    const markers = [];
    const markerExtents = new Map();
    const us = this;
    this.missionPlanMarkers.set(name, markers);
    this.missionPlanMarkerExtents.set(name, markerExtents);
    // map.render();
  }

  setSelectedMissionAction(actionIndex) {
    this.setState({ selectedMissionAction: parseInt(actionIndex, 10) }, this.reRenderMissionPlan);
  }

  loadMissionPlanData(name, data) {
    const { missionPlanData } = this.state;
    missionPlanData.set(name, data);
    this.setState({ missionPlanData });
    this.renderMissionPlan(name, data);
  }

  isMissionPlanLoaded(name) {
    const { missionPlanData } = this.state;
    return missionPlanData.has(name);
  }

  setMissionPlanFileDirty(name, dirty) {
    const { missionPlanData } = this.state;
    if (!missionPlanData.has(name)) {
      console.error(`Requested operation on missing plan file ${name}`);
      return;
    }
    const plan = missionPlanData.get(name);
    plan.isDirty = dirty;
    missionPlanData.set(name, plan);
    this.setState({ missionPlanData });
  }

  setMissionPlanFileLocked(name, locked) {
    const { missionPlanData } = this.state;
    if (!missionPlanData.has(name)) {
      console.error(`Requested operation on missing plan file ${name}`);
      return;
    }
    const plan = missionPlanData.get(name);
    plan.isLocked = locked;
    missionPlanData.set(name, plan);
    this.setState({ missionPlanData });
  }

  setMissionPlanVisibility(name, visible) {
    const { missionPlanData } = this.state;
    if (!missionPlanData.has(name)) {
      console.error(`Requested operation on missing plan file ${name}`);
      return;
    }
    const plan = missionPlanData.get(name);
    const planMarkers = this.missionPlanMarkers.get(name);
    plan.isVisible = visible;
    planMarkers.forEach((marker) => {
      marker.setVisible(visible);
    });
    missionPlanData.set(name, plan);
    this.setState({ missionPlanData });
  }

  setActiveEditMissionPlan(name) {
    const { missionPlanData } = this.state;
    let activeEditMissionPlan = null;
    missionPlanData.forEach((value, key, mpData) => {
      const plan = mpData.get(key);
      if (plan.name === name) {
        if (!plan.isActiveEdit) {
          info(`Editing plan "${name}"`);
        }
        plan.isActiveEdit = true;
        activeEditMissionPlan = plan;
      } else {
        plan.isActiveEdit = false;
      }
      if (/* plan.isVisible || */ plan.isActiveEdit) {
        this.renderMissionPlan(plan.name, plan);
      } else {
        this.unRenderMissionPlan(plan.name);
      }
      mpData.set(key, plan);
    });
    this.setState({
      missionPlanData,
      activeEditMissionPlan,
      missionManagerMode: activeEditMissionPlan ? 'edit' : 'closed'
    });
  }

  static validateMissionAction(action) {
    if (action.type === '') return false;
    return true;
  }

  static compareMissionAction(firstEl, secondEl) {
    if (parseInt(firstEl.triggerCondition, 10) > parseInt(secondEl.triggerCondition, 10)) return 1;
    if (parseInt(firstEl.triggerCondition, 10) < parseInt(secondEl.triggerCondition, 10)) return -1;
    return 0;
  }

  static fixupMissionPlan(planData) {
    if (!planData) return planData;
    let out = [];
    for (let i = 0; i < planData.length; i += 1) {
      if (AXUI.validateMissionAction(planData[i])) {
        out.push(planData[i]);
      }
    }
    out = out.sort(AXUI.compareMissionAction);
    return out;
  }

  zoomToMissionPlanExtent(name) {
    const { missionPlanData, missionExecutionState } = this.state;
    if (!missionPlanData.has(name)) {
      if (missionExecutionState.missionPlan) {
        const extent = OlCreateEmptyExtent();
        let layerCount = 0;
        this.missionPlanMarkers.get(missionExecutionState.planName).forEach((marker) => {
          OlExtendExtent(extent, marker.getExtent());
          layerCount += 1;
        });
        if (layerCount > 0) this.fit(extent, { duration: 500 });
        return;
      }
      console.error(`Requested operation on missing plan file ${name}`);
      return;
    }
    const plan = missionPlanData.get(name);
    plan.isVisible = true;
    missionPlanData.set(name, plan);
    this.setState({ missionPlanData });
    this.renderMissionPlan(name, plan);
    const extent = OlCreateEmptyExtent();
    let layerCount = 0;
    this.missionPlanMarkers.get(name).forEach((marker) => {
      OlExtendExtent(extent, marker.getExtent());
      layerCount += 1;
    });
    if (layerCount > 0) this.fit(extent, { duration: 500 }, true);
  }

  zoomToMissionFormation(name, index) {
    const { missionPlanMarkerExtents } = this.state;
    const extent = this.missionPlanMarkerExtents.get(name).get(index);
    this.fit(extent, { duration: 500 }, true);
  }

  updateMissionPlan(name, data) {
    const { missionPlanData } = this.state;
    if (!missionPlanData.has(name)) {
      console.error(`Requested operation on missing plan file ${name}`);
      return;
    }
    const plan = missionPlanData.get(name);
    plan.data = data;
    plan.isDirty = true;
    missionPlanData.set(name, plan);
    this.setState({ missionPlanData });
    this.renderMissionPlan(name, plan);
  }

  static newMissionPlan() {
    return {
      name: dateFormat('yyyy-mm-dd hh.MM.sstt Z'),
      data: [],
      isVisible: true,
      isDirty: true,
      isActiveEdit: false,
      isLocked: false
    };
  }

  startMission(name) {
    const { missionPlanData, activeEditMissionPlan } = this.state;
    let plan;
    if (name) {
      if (!missionPlanData.has(name)) {
        console.error(`Requested operation on missing plan file ${name}`);
        return;
      }
      plan = missionPlanData.get(name);
    } else {
      plan = activeEditMissionPlan;
    }
    this.setSelectedMissionAction(-1);
    this.setActiveEditMissionPlan(null);

    this.setMissionPlanFileLocked(plan.name, true);

    this.missionExecutionAPI.post(`start/${plan.name}`).then(
      (result) => {
        if (result.ok) {
          this.setState({ missionExecutionState: result.missionStatus });
          this.setState({ mode: this.modes.exec });
          success(`Started mission ${plan.name}`);
        } else {
          console.error(result.msg);
          error(`Failed to start mission ${plan.name}: ${result.msg}`);
        }
      },
      (failReason) => {
        console.error(failReason);
        error(`Failed to start mission ${plan.name}: ${failReason}`);
      }
    );
  }

  skipToNextMissionAction() {
    this.missionExecutionAPI.post('next').then(
      (result) => {
        if (result.ok) {
          this.setState({ missionExecutionState: result.missionStatus });
          success('Skipped to next mission action');
        } else {
          error(`Failed to skip: ${result.msg}`);
        }
      },
      (failReason) => {
        error(`Failed to skip: ${failReason}`);
      }
    );
  }

  pollMissionStatus() {
    clearInterval(this.missionStatusTimer);
    const us = this;
    let newAction = false;
    let missionDone = false;
    const { missionExecutionState } = this.state;
    this.missionExecutionAPI.get('status').then(
      (result) => {
        if (result.missionStatus) {
          if (
            result.missionStatus.missionSegment !== missionExecutionState.missionSegment
            && parseInt(result.missionStatus.missionSegment, 10) !== -1
          ) {
            newAction = true;
          }
          if (
            result.missionStatus.missionComplete !== missionExecutionState.missionComplete
            && result.missionStatus.missionComplete === true
          ) {
            missionDone = true;
          }
          us.setState({ missionExecutionState: result.missionStatus });
          if (
            result.missionStatus.isActive
            && result.missionStatus.missionPlan
            && result.missionStatus.missionPlan.length > 0
          ) {
            us.renderMissionPlan(result.missionStatus.planName, {
              data: result.missionStatus.missionPlan,
              activeSegment: parseInt(result.missionStatus.missionSegment, 10)
            });
          }
          if (newAction) {
            const cmd = result.missionStatus.missionPlan[parseInt(result.missionStatus.missionSegment, 10)];
            success(`Executing command ${result.missionStatus.missionSegment + 1}`);
          }
          if (missionDone) {
            success('Mission completed.');
          }
          us.missionStatusTimer = setInterval(() => us.pollMissionStatus(), 250);
        } else {
          console.error(result);
          us.missionStatusTimer = setInterval(() => us.pollMissionStatus(), 2500);
          error(`Unable to connect to mission computer: ${result}`);
        }
      },
      (failReason) => {
        console.error(failReason);
        us.missionStatusTimer = setInterval(() => us.pollMissionStatus(), 2500);
        error(`Unable to connect to mission computer: ${failReason}`);
      }
    );
  }

  setMissionManagerMode(mode) {
    this.setState({ missionManagerMode: mode });
  }

  sendStop() {
    console.log('STOP')
    this.sna.allStop()
  }

  sendCommand(command) {
    info(`Sending ${command.type} command`);
    switch (command.type) {
      case 'formation':
        this.sna.sendPodCommand(command.formationType, command.formationParameters);
        break;
      case 'other':
        this.sna.sendOtherCommand(command.OtherCommand, command.parameters);
        break;
      default:
        error('Invalid command type');
        break;
    }
  }

  openBotsDrawer() {
    $('#botsDrawer').show('blind', { direction: 'up' });
    this.setState({ botsDrawerOpen: true });
  }

  closeBotsDrawer() {
    $('#botsDrawer').hide('blind', { direction: 'up' });
    this.setState({ botsDrawerOpen: false });
  }

  openCommandDrawer() {
    $('#commandsDrawer').show('blind', { direction: 'down' });
    this.setState({ commandDrawerOpen: true });
  }

  closeCommandDrawer() {
    $('#commandsDrawer').hide('blind', { direction: 'down' });
    this.setState({ commandDrawerOpen: false });
  }

  openMissionDrawer() {
    $('#missionDrawer').show('blind', { direction: 'up' });
    this.setState({ missionDrawerOpen: true });
    this.setViewportEdge(1, $('#missionDrawer').width());
  }

  closeMissionDrawer() {
    $('#missionDrawer').hide('blind', { direction: 'up' });
    this.setState({ missionDrawerOpen: false });
    this.setViewportEdge(1, 0);
  }

  static formatLength(line) {
    const length = OlGetLength(line, { projection: mercator });
    if (length > 100) {
      return `${Math.round((length / 1000) * 100) / 100} km`;
    }
    return `${Math.round(length * 100) / 100} m`;
  }

  static showHelpText() {
    // Add transparent overlay
    // const overlay = $(document).?
    // Set overlay to top layer
    // Add click handler
    // Get coords
    // Remove overlay
    // Get element at coords
    // const elem = elementFromPoint(x, y);
    // Get title attr
    // const title = elem.getAttribute('title');
    // If no title, find first parent element with title
    // Show title in popup
  }

  static getPodDiverStatus(feature) {
    const rfState = parseInt(feature.get('commState') || 0, 10);
    const faultState = parseInt(feature.get('faultState') || 0, 10);
    // const commandState = parseInt(feature.get('commandState') || 0, 10); // commandState doesn't tell us anything
    const batteryState = parseInt(feature.get('batteryState') || 0, 10);
    const otherState = parseInt(feature.get('otherMarker') || 0, 10);

    // First we show RF errors, because if we haven't heard from the bot there's no other state data to be had
    if (rfState >= 1) {
      return JaiaAPI.getCommunicationStateDescription(feature.get('commState'));
    }
    if (faultState === 6) {
      return JaiaAPI.getFaultStateDescription(feature.get('faultState'));
    }
    // Then faults
    //   faultState 7 is reported by Podulator
    if (faultState >= 4 && faultState !== 7) {
      return JaiaAPI.getFaultStateDescription(feature.get('faultState'));
    }
    // Battery states over 7 might show up as faults, but there is a separate battery field so it doesn't matter that they are lower priority here
    /*
    if (batteryState >= 7) {
      return JaiaAPI.getBatteryStateDescription(feature.get('batteryState'));
    }
    */
    if (faultState >= 3 && faultState !== 7) {
      return JaiaAPI.getFaultStateDescription(feature.get('faultState'));
    }
    if (otherState > 0) {
      return JaiaAPI.getStateDescription(feature.get('otherMarker'));
    }
    if (faultState >= 1) {
      return JaiaAPI.getFaultStateDescription(feature.get('faultState'));
    }
    return 'Good';
  }

  // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
  // eslint-disable-next-line class-methods-use-this
  toggleButton(id) {
    return '';
    /*
    const { panelsVisibility } = this.state;
    const us = this;
    return (
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <div
        className="panelToggleButton"
        role="button"
        tabIndex={0}
        onClick={() => {
          // eslint-disable-next-line no-shadow
          const { panelsVisibility } = us.state;
          if (panelsVisibility[id]) {
            $(`#${id}`).hide('blind', {}, 500);
          } else {
            $(`#${id}`).show('blind', {}, 500);
          }
          us.setState({
            panelsVisibility: { [id]: !panelsVisibility[id] }
          });
        }}
        // No clue if this works
        // It does not: onKeyUp={this.onClick}
      >
        <FontAwesomeIcon key={id} icon={panelsVisibility[id] ? faCaretDown : faCaretLeft} />
      </div>
    );
      */
  }

  addTestSurveyMarker() {
    const { testSurveyMarker } = this.state;
    testSurveyMarker.addInteractively(this.changeInteraction.bind(this));
  }

  dive() {
    this.sna.sendDiveCommand()
  }

  render() {
    const {
      debugMode,
      selectedBotsFeatureCollection,
      botsLayerCollection,
      controlRecipient,
      // cursorLocation,
      panelsVisibility,
      poiLayerCollection,
      trackingTarget,
      mapZoomLevel,
      activeEditFile,
      activeEditLayer,
      activeEditWaypoint,
      activeFileIsDirty,
      missionPlanData,
      activeEditMissionPlan,
      missionManagerMode,
      missionExecutionState,
      liveCommand,
      selectedMissionAction,
      faultCounts,
      controlHeading,
      controlSpeed,
      missionDrawerOpen,
      botsDrawerOpen,
      commandDrawerOpen,
      measureFeature,
      measureActive,
      headingControlMarker
    } = this.state;
    const us = this;

    if (controlRecipient && headingControlMarker.isVisible()) {
      $('#speedControl').show();
      $('#speedSlider').slider('value', controlSpeed);
    } else {
      $('#speedControl').hide();
    }
    // map.render();

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

            <div className="panel">
              <h2>Pod Control</h2>
              {this.toggleButton('podControlContainer')}
              <div id="podControlContainer" className="scroll">
                {this.sna ? <PodControl map={map} sna={this.sna} /> : 'No pod connection'}
              </div>
            </div>

            <div className="panel">
              <h2>Asset Control</h2>
              {/* TODO implement direct rudder control */}
              {this.toggleButton('assetControlContainer')}
              <div id="assetControlContainer" className="scroll">
                {controlRecipient ? (
                  <AssetControl key={controlRecipient.getId()} map={map} asset={controlRecipient} sna={this.sna} />
                ) : (
                  'No bot under your control.'
                )}
              </div>
            </div>

            <div className="panel">
              <h2>Log</h2>
              <button
                type="button"
                onClick={() => {
                  $('#logContainer').html(messageLog.reduce((accum, value) => `${accum}<div>${value}</div>`, ''));
                }}
              >
                Refresh log
              </button>
              <div id="logContainer" className="scroll" />
            </div>

            <div className="panel">
              {debugMode? (
                <div id="debugButtons">
              <div>
                <button type="button" onClick={this.addTestSurveyMarker.bind(this)}>
                  Test survey marker
                </button>
              </div>
              <div>
                <button type="button" onClick={this.disconnectPod.bind(this)}>
                  Disconnect from pod
                </button>
              </div>
              </div>
              ) : ''}
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
            {/*
            {' '}
Pod
        */}
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
          {controlRecipient && controlRecipient.getId() !== '' ? (
            <button
              type="button"
              onClick={this.unsetControlRecipient.bind(this)}
              className="active-rc"
              title="Release Control"
            >
              <FontAwesomeIcon icon={faDharmachakra} />
              {controlRecipient.getId().toString()}
            </button>
          ) : (
            ''
          )}
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
                    }${controlRecipient && feature.getId() === controlRecipient.getId() ? ' controlled' : ''}${
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
                  className={`${
                    controlRecipient && feature.getId() === controlRecipient.getId() ? ' controlled' : ''
                  }`}
                >
                  {BotDetailsComponent(this.podStatus?.bots?.[feature.getId()])}
                  <div id="botContextCommandBox">
                    {/* Leader-based commands and manual control go here */}
                    {controlRecipient && feature.getId() === controlRecipient.getId() ? (
                      <button
                        type="button"
                        onClick={this.unsetControlRecipient.bind(this)}
                        className="active-rc"
                        title="Release Control"
                      >
                        <FontAwesomeIcon icon={faDharmachakra} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={this.setControlRecipient.bind(this, feature)}
                        className=""
                        title="Control Bot"
                      >
                        <FontAwesomeIcon icon={faDharmachakra} />
                      </button>
                    )}
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
                        {!controlRecipient || feature.getId() === controlRecipient.getId() ? (
                          <button
                            type="button"
                            onClick={this.trackBot.bind(this, feature.getId())}
                            title="Follow Bot"
                            className="toggle-inactive"
                          >
                            <FontAwesomeIcon icon={faMapPin} />
                          </button>
                        ) : (
                          ''
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))
              : ''}
          </div>
        </div>

        <div id="speedControl">
          {/*
          onMouseDown={this.startAcceleration.bind(this)} onMouseUp={this.cancelAcceleration.bind(this)}
          onTouchStart={this.startAcceleration.bind(this)} onTouchEnd={this.cancelAcceleration.bind(this)}
          */}

          <button
            type="button"
            id="throttleButtonSingle"
            onPointerDown={this.startAcceleration.bind(this)}
            onPointerUp={this.cancelAcceleration.bind(this)}
            onBlur={this.cancelAcceleration.bind(this)}
            onMouseLeave={this.cancelAcceleration.bind(this)}
            onMouseUp={this.cancelAcceleration.bind(this)}
            onMouseOut={this.cancelAcceleration.bind(this)}
            onPointerCancel={this.cancelAcceleration.bind(this)}
            onLostPointerCapture={this.cancelAcceleration.bind(this)}
            onPointerLeave={this.cancelAcceleration.bind(this)}
            onPointerOut={this.cancelAcceleration.bind(this)}
            onTouchEnd={this.cancelAcceleration.bind(this)}
            onTouchCancel={this.cancelAcceleration.bind(this)}
            title="Press and Hold to Accelerate"
          >
            {/*
            onDragStart={this.cancelAcceleration.bind(this)}
            onDragLeave={this.cancelAcceleration.bind(this)}
            onDragExit={this.cancelAcceleration.bind(this)}
            */}
            Hold to Accelerate
          </button>

          {/*
          <div>
            <button type="button" onClick={this.sendThrottle.bind(this, 0)} title="Stop">
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>
          <div id="speedSlider" />
          <div>
            <button type="button" onClick={this.sendThrottle.bind(this, 100)} title="Max Speed">
              Max
            </button>
          </div>
          */}
        </div>

        <div
          id="commandsButton"
          onClick={commandDrawerOpen ? this.closeCommandDrawer.bind(this) : this.openCommandDrawer.bind(this)}
        >
          <h2>
            <FontAwesomeIcon icon={faDirections} />
            {/*
            {' '}
Commands
            */}
          </h2>
          {commandDrawerOpen ? (
            <button
              type="button"
              id="toggleCommandDrawer"
              className="not-a-button"
              onClick={this.closeCommandDrawer.bind(this)}
              title="Close Command Drawer"
            >
              <FontAwesomeIcon icon={faChevronUp} />
            </button>
          ) : (
            <button
              type="button"
              id="toggleCommandDrawer"
              className="not-a-button"
              onClick={this.openCommandDrawer.bind(this)}
              title="Open Command Drawer"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
          )}
        </div>
        <div id="commandsDrawer">
          <div id="globalCommandBox">
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '5' ? ' selected' : ''
              }`}
              title="Sample Data at Surface"
            >
              <img src={cmdIconLineData} alt="" />
            </button>
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '3' ? ' selected' : ''
              }`}
              title="Dive Bottom"
            >
              <img src={cmdIconDiveBottom} alt="" />
            </button>
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '4' ? ' selected' : ''
              }`}
              title="Dive Drift"
            >
              <img src={cmdIconDiveDrift} alt="" />
            </button>
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '2' ? ' selected' : ''
              }`}
              title="Dive Profile"
            >
              <img src={cmdIconDiveProfile} alt="" />
            </button>
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '1' ? ' selected' : ''
              }`}
              title="Return Home"
            >
              <img src={cmdIconRTH} alt="" />
            </button>
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '0' ? ' selected' : ''
              }`}
              title="Beep"
            >
              <img src={cmdIconBeep} alt="Beep" />
              {/* <FontAwesomeIcon icon={faVolumeUp} /> */}
            </button>
            <button
              type="button"
              className={`globalCommand${
                liveCommand && liveCommand.type === 'other' && liveCommand.OtherCommand === '11' ? ' selected' : ''
              }`}
              title="Other LED blink pattern"
            >
              <img src={cmdIconLED} alt="LED" />
            </button>
          </div>
        </div>

        {activeEditLayer ? (
          <div id="controlsOverlay">
            <LayerEditControls
              activeEditLayer={activeEditLayer}
              map={map}
              changeInteraction={this.changeInteraction}
              mapView={this}
              setActiveFileDirty={this.setActiveFileDirty}
              setActiveEditWaypoint={this.setActiveEditWaypoint}
              waypointDefaultProperties={waypointDefaultProperties}
            />
          </div>
        ) : (
          ''
        )}

        {activeEditWaypoint ? (
          <div id="mapContextOverlay">
            <FeaturePropertiesEditor
              activeEditWaypoint={activeEditWaypoint}
              map={map}
              setActiveFileDirty={this.setActiveFileDirty}
              setActiveEditWaypoint={this.setActiveEditWaypoint}
              mapView={this}
            />
          </div>
        ) : (
          ''
        )}

        <div>Testing</div>

        <div id="missionSummary">
          {!missionExecutionState || !missionExecutionState.isActive ? (
            <div id="missionFileManager" onClick={this.openMissionDrawer.bind(this)}>
              {missionManagerMode === 'closed' ? (
                <h2>
                  <FontAwesomeIcon icon={faRoute} />
                </h2>
              ) : (
                ''
              )}
              <FileManager
                source="/missionfiles"
                mode={missionManagerMode}
                setMode={this.setMissionManagerMode}
                loadData={this.loadMissionPlanData}
                createNewDataObject={AXUI.newMissionPlan}
                loadedFileData={missionPlanData}
                setFileDirty={this.setMissionPlanFileDirty}
                setFileLocked={this.setMissionPlanFileLocked}
                setDataVisibility={this.setMissionPlanVisibility}
                setActiveEditFile={this.setActiveEditMissionPlan}
                zoomToFileLayerExtent={this.zoomToMissionPlanExtent}
                activeEditFile={activeEditMissionPlan ? activeEditMissionPlan.name : ''}
                additionalFileActions={[
                  {
                    name: 'Execute',
                    description: 'Execute Mission Plan',
                    callback: this.startMission,
                    icon: <FontAwesomeIcon icon={faPlay} />
                  }
                ]}
                normalizeDataForStorage={AXUI.fixupMissionPlan}
              />
            </div>
          ) : (
            <div id="missionControl">
              <MissionControl
                missionExecutionState={missionExecutionState}
                startMission={this.startMission}
                stopMission={this.stopMission}
              />
            </div>
          )}
          {missionDrawerOpen ? (
            <button
              type="button"
              id="toggleMissionDrawer"
              className="not-a-button"
              onClick={this.closeMissionDrawer.bind(this)}
              title="Close Mission Panel"
            >
              <FontAwesomeIcon icon={faChevronDown} />
            </button>
          ) : (
            <button
              type="button"
              id="toggleMissionDrawer"
              className="not-a-button"
              onClick={this.openMissionDrawer.bind(this)}
              title="Open Mission Panel"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
          )}
        </div>
        <div id="missionDrawer">
          {!missionExecutionState || !missionExecutionState.isActive ? (
            <div id="missionPlanning">
              {activeEditMissionPlan && activeEditMissionPlan.name !== '' ? (
                <div id="missionPlanner">
                  <MissionEditor
                    missionName={activeEditMissionPlan.name}
                    missionPlan={activeEditMissionPlan.data}
                    changeInteraction={this.changeInteraction}
                    // eslint-disable-next-line react/jsx-no-bind
                    updateMissionPlan={this.updateMissionPlan.bind(this, activeEditMissionPlan.name)}
                    executeMissionPlan={this.startMission}
                    sna={this.sna}
                    dataLayerCollection={poiLayerCollection}
                    selectedMissionAction={selectedMissionAction}
                    setSelectedMissionAction={this.setSelectedMissionAction}
                    zoomToFileLayerExtent={this.zoomToMissionPlanExtent.bind(this, activeEditMissionPlan.name)}
                    zoomToFormation={this.zoomToMissionFormation.bind(this, activeEditMissionPlan.name)}
                    $={$}
                    sendCommand={this.sendCommand}
                  />
                </div>
              ) : (
                ''
              )}
            </div>
          ) : (
            <div id="missionExecution">
              {missionExecutionState.missionPlan ? (
                <div id="missionPlanView">
                  <MissionEditor
                    missionPlan={missionExecutionState.missionPlan}
                    changeInteraction={this.changeInteraction}
                    // eslint-disable-next-line react/jsx-no-bind
                    updateMissionPlan={() => {}}
                    sna={this.sna}
                    dataLayerCollection={poiLayerCollection}
                    selectedMissionAction={selectedMissionAction}
                    setSelectedMissionAction={this.setSelectedMissionAction}
                    readOnly
                    activeMissionAction={missionExecutionState.missionSegment}
                    zoomToFileLayerExtent={this.zoomToMissionPlanExtent}
                    zoomToFormation={this.zoomToMissionFormation.bind(this, missionExecutionState.planName)}
                    sendCommand={this.sendCommand}
                    execNextMissionAction={this.skipToNextMissionAction}
                  />
                </div>
              ) : (
                ''
              )}
            </div>
          )}
        </div>

        {/*
          <div id="statusBar">
            Latitude:
            {' '}
            <span id="statusLatitude">{cursorLocation.latitude.toFixed(6)}</span>
            {'   |   '}
            Longitude:
            {' '}
            <span id="statusLongitude">{cursorLocation.longitude.toFixed(6)}</span>
            {debugMode ? (
              <span>
                {'   |   '}
                Zoom:
                {' '}
                <span id="statusZoom">{mapZoomLevel.toFixed(1)}</span>
              </span>
            ) : (
              ''
            )}
          </div>
          */}
      </div>
    );
  }

  didClickMap(evt) {
    var lonlat = mercator_to_equirectangular(evt.coordinate)
    var lon = lonlat[0]
    var lat = lonlat[1]

    let botId = 0

    if (!(botId in this.missions)) {
      this.missions[botId] = []
    }

    this.missions[botId].push([lon, lat])

    // Update the mission layer
    let features = this.missions[botId].map((location) => {
      return new OlFeature({
        geometry: new OlPoint(equirectangular_to_mercator(location)),
      })
    })
    
    var markers = new OlVectorSource({
        features: features
    })

    this.missionLayer.setSource(markers)

    // Issue command

    let goals = this.missions[botId].map((location) => {
      return {'location': {'lon': location[0], 'lat': location[1]}}
    })

    this.sna.postCommand({
      'botId': botId,
      'time': '1642891753471247',
      'type': 'MISSION_PLAN',
      'plan': {
        'start': 'START_IMMEDIATELY',
        'movement': 'TRANSIT',
        'goal': goals,
        'recovery': {'recoverAtFinalGoal': true}
      }
    })
  }
}

// =================================================================================================
