/* eslint-disable no-bitwise */
import OlMap from 'ol/Map';
import OlView from 'ol/View';
import OlLayerGroup from 'ol/layer/Group';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceXYZ from 'ol/source/XYZ';
import { Vector as OlVectorSource } from 'ol/source';
import { Vector as OlVectorLayer } from 'ol/layer';
import OlCollection from 'ol/Collection';
import OlPoint from 'ol/geom/Point';
import OlLineString from 'ol/geom/LineString';
import OlFeature from 'ol/Feature';
import OlTileLayer from 'ol/layer/Tile';
import { click, altKeyOnly } from 'ol/events/condition';
import { createEmpty as OlCreateEmptyExtent, extend as OlExtendExtent } from 'ol/extent';
import OlZoomSlider from 'ol/control/ZoomSlider';
import OlScaleLine from 'ol/control/ScaleLine';
import OlZoom from 'ol/control/Zoom';
import OlRotate from 'ol/control/Rotate';
import {
  Draw as OlDraw,
  Modify as OlModify,
  Select as OlSelect,
  defaults as OlDefaultInteractions,
  Pointer as OlPointerInteraction,
  Translate as OlTranslate
} from 'ol/interaction';
import { createBox as OlCreateBox } from 'ol/interaction/Draw';
import OlPolygon from 'ol/geom/Polygon';
import OlStyle from 'ol/style/Style';
import OlText from 'ol/style/Text';
import OlFill from 'ol/style/Fill';
import OlStroke from 'ol/style/Stroke';
import OlCircleStyle from 'ol/style/Circle';
import { asArray as colorAsArray } from 'ol/color';
import OlCircle from 'ol/geom/Circle';

import {
  error, success, warning, info, debug, messageLog
} from './notifications';

import shapes from './shapes';

import { getCoordsFromHeadingAndDistance, getHeadingAndDistanceFromCoords, AngDiff } from '../../common/GeoMath';
import FormationGeometry from '../../common/FormationGeometry';
import RectangleSurveyGeometry from '../../common/SurveyGeometry';

const { getHandleStyle } = shapes;

export default class RectangleSurveyMarker {
  constructor(id, map, layerCollection, numBots, onChangeCallback, fillColor = '#2073BA', onClick = null) {
    this.id = id;
    this.map = map;
    this.layerCollection = layerCollection;

    this.onChangeCallback = onChangeCallback;

    this.onClick = onClick;
    this.color = fillColor;

    this.numberOfGhostBots = numBots;

    this.features = new OlCollection([], { unique: true });
    this.layer = new OlVectorLayer({
      name: this.id.toString(),
      source: new OlVectorSource({
        wrapX: false,
        features: this.features
      }),
      style: getHandleStyle(this.color),
      // Hopefully this speeds up rendering. It does at least prevent disappearing while zooming.
      renderMode: 'image'
    });
    this.layerCollection.push(this.layer);

    // Main shape/outline/area
    this.rectangleFeature = null;

    // 1x move handle
    // Drag this one to translate
    this.moveHandleFeature = null;
    this.moveHandleInteraction = null;

    // 8x resize handles
    // top left
    this.resizeHandleTLFeature = null;
    this.resizeHandleTLInteraction = null;
    // top center
    this.resizeHandleTCFeature = null;
    // top right
    this.resizeHandleTRFeature = null;
    // center left
    this.resizeHandleCLFeature = null;
    // center right
    this.resizeHandleCRFeature = null;
    // bottom left
    this.resizeHandleBLFeature = null;
    // bottom center
    this.resizeHandleBCFeature = null;
    // bottom right
    this.resizeHandleBRFeature = null;

    // 1x rotate handles
    this.rotateHandleFeature = null;

    // 1x separation adjustment handle
    this.separationHandleFeature = null;

    // Lots of ghost bots
    this.ghostBotFeatures = [];

    this.center = [0, 0];
    this.height = 0;
    this.width = 0;
    this.heading = 0;
    this.separation = 10; // gets set when initial rectangle is drawn to make the spacing proportions the same as the rectangle proportions
  }

  getCoord(coordID) {
    const leftCenter = getCoordsFromHeadingAndDistance(this.center, this.heading - 90, this.width / 2);
    if (coordID === 'CL') return leftCenter;
    const rightCenter = getCoordsFromHeadingAndDistance(this.center, this.heading + 90, this.width / 2);
    if (coordID === 'CR') return rightCenter;

    const centerToLeft = getHeadingAndDistanceFromCoords(this.center, leftCenter);
    const centerToRight = getHeadingAndDistanceFromCoords(this.center, rightCenter);

    switch (coordID) {
      case 'TL':
        return getCoordsFromHeadingAndDistance(leftCenter, centerToLeft.azi2 + 90, this.height / 2);
      case 'TC':
        return getCoordsFromHeadingAndDistance(this.center, this.heading, this.height / 2);
      case 'TR':
        return getCoordsFromHeadingAndDistance(rightCenter, centerToRight.azi2 - 90, this.height / 2);
      case 'BL':
        return getCoordsFromHeadingAndDistance(leftCenter, centerToLeft.azi2 - 90, this.height / 2);
      case 'BC':
        return getCoordsFromHeadingAndDistance(this.center, this.heading + 180, this.height / 2);
      case 'BR':
        return getCoordsFromHeadingAndDistance(rightCenter, centerToRight.azi2 + 90, this.height / 2);
      case 'ROT':
        return getCoordsFromHeadingAndDistance(this.center, this.heading + 90, this.width);
      case 'SEP':
      {
        // Don't put it right at vertical center because it can overlap the moveHandle
        const sepOffset = getCoordsFromHeadingAndDistance(leftCenter, centerToLeft.azi2 - 90, this.height / 4);
        // Need to get angle
        const clToSepOffset = getHeadingAndDistanceFromCoords(leftCenter, sepOffset);
        return getCoordsFromHeadingAndDistance(sepOffset, clToSepOffset.azi2 - 90, this.separation);
      }
      default:
        console.error(`Invalid coordinate ID: ${coordID}`);
        return [NaN, NaN];
    }
  }

  createFromBox(boxFeature) {
    const boxCoordinates = boxFeature.getGeometry().getCoordinates()[0];
    // This does rely on Openlayers implementation details (Draw.js:1006)
    const bottomLeft = boxCoordinates[0];
    const bottomRight = boxCoordinates[1];
    const topRight = boxCoordinates[2];
    const topLeft = boxCoordinates[3];

    const leftSide = getHeadingAndDistanceFromCoords(bottomLeft, topLeft);
    const bottomSide = getHeadingAndDistanceFromCoords(bottomLeft, bottomRight);
    const height = leftSide.s12;
    const width = bottomSide.s12;
    if (height > 100000 || width > 100000) {
      error('Areas with sides longer than 100km are not supported');
      return;
    }
    const leftCenter = getCoordsFromHeadingAndDistance(bottomLeft, 0, height / 2);
    const center = getCoordsFromHeadingAndDistance(leftCenter, 90, width / 2);
    this.create(center[1], center[0], height, width, 0, width / this.numberOfGhostBots);
    this.enableEdit();
  }

  create(latitude, longitude, height, width, heading, separation) {
    this.center = [longitude, latitude];
    this.height = height > 1 ? height : 1;
    this.width = width > 1 ? width : 1;
    this.heading = heading % 360;
    this.separation = separation;

    if (this.separation < 1) this.separation = 1;

    this.rectangleFeature = new OlFeature({});
    this.rectangleFeature.setId(`${this.id}`);
    this.rectangleFeature.setStyle(
      new OlStyle({
        stroke: new OlStroke({
          color: this.color,
          width: 3
        })
      })
    );
    this.features.push(this.rectangleFeature);

    // 1x move handle
    this.moveHandleFeature = new OlFeature({
      geometry: new OlPoint(this.center)
    });
    // Add to this.features later so it will be on top
    this.moveHandleInteraction = new OlTranslate({
      features: new OlCollection([this.moveHandleFeature], { unique: true })
    });
    this.moveHandleInteraction.on('translating', (e) => {
      const delta = getHeadingAndDistanceFromCoords(this.center, e.coordinate);
      const newHeading = this.heading + (delta.azi2 - delta.azi1);
      this.updateInternal(e.coordinate, null, null, newHeading, null);
    });
    this.moveHandleInteraction.on('translateend', this.doneMoving);

    // 1x rotate handles
    this.rotateHandleFeature = new OlFeature({});
    this.features.push(this.rotateHandleFeature);

    this.rotateHandleInteraction = new OlTranslate({
      features: new OlCollection([this.rotateHandleFeature], { unique: true })
    });
    this.rotateHandleInteraction.on('translating', (e) => {
      const delta = getHeadingAndDistanceFromCoords(this.center, e.coordinate);
      this.updateInternal(null, null, null, delta.azi1 - 90, null);
    });
    this.rotateHandleInteraction.on('translateend', this.doneMoving);

    // 1x separation handles
    this.separationHandleFeature = new OlFeature({});
    this.features.push(this.separationHandleFeature);

    this.separationHandleInteraction = new OlTranslate({
      features: new OlCollection([this.separationHandleFeature], { unique: true })
    });
    this.separationHandleInteraction.on('translating', (e) => {
      const vCLtoE = getHeadingAndDistanceFromCoords(this.getCoord('CL'), e.coordinate);
      const vCLtoCENTER = getHeadingAndDistanceFromCoords(this.getCoord('CL'), this.center);
      const offAngle = AngDiff(vCLtoCENTER.azi1, vCLtoE.azi1);
      const newSep = Math.cos((offAngle * Math.PI / 180)) * vCLtoE.s12;
      this.updateInternal(null, null, null, null, newSep);
    });
    this.separationHandleInteraction.on('translateend', this.doneMoving);

    // 8x resize handles
    // top left
    this.resizeHandleTLFeature = new OlFeature({});
    this.features.push(this.resizeHandleTLFeature);

    this.resizeHandleTLInteraction = new OlTranslate({
      features: new OlCollection([this.resizeHandleTLFeature], { unique: true })
    });
    this.resizeHandleTLInteraction.on('translating', (e) => {
      const delta = getHeadingAndDistanceFromCoords(this.getCoord('TL'), e.coordinate);
      const oppositeCorner = this.getCoord('BR');
      const newDiag = getHeadingAndDistanceFromCoords(e.coordinate, oppositeCorner);
      const newRadius = newDiag.s12 / 2;
      const newCenter = getCoordsFromHeadingAndDistance(e.coordinate, newDiag.azi1, newRadius);
      const cDelta = getHeadingAndDistanceFromCoords(this.center, newCenter);
      if (cDelta.s12 - delta.s12 / 2 > 1) {
        console.log(`Off by ${cDelta.s12 - delta.s12 / 2}m`);
        error('Geometry is too large!');
        return;
      }
      const rectangleProportionAngle = AngDiff(
        this.heading,
        getHeadingAndDistanceFromCoords(newCenter, e.coordinate).azi1
      );
      if (rectangleProportionAngle < 0 || rectangleProportionAngle > 90) {
        return;
      }
      const newHeight = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle + 180, newRadius)
      ).s12;
      const newWidth = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle, newRadius)
      ).s12;
      if (newHeight > 1 && newWidth > 1) {
        this.updateInternal(newCenter, newHeight, newWidth, null, null);
      }
    });
    this.resizeHandleTLInteraction.on('translateend', this.doneMoving);

    // top center
    this.resizeHandleTCFeature = new OlFeature({});
    this.features.push(this.resizeHandleTCFeature);

    // top right
    this.resizeHandleTRFeature = new OlFeature({});
    this.features.push(this.resizeHandleTRFeature);

    this.resizeHandleTRInteraction = new OlTranslate({
      features: new OlCollection([this.resizeHandleTRFeature], { unique: true })
    });
    this.resizeHandleTRInteraction.on('translating', (e) => {
      const delta = getHeadingAndDistanceFromCoords(this.getCoord('TR'), e.coordinate);
      const oppositeCorner = this.getCoord('BL');
      const newDiag = getHeadingAndDistanceFromCoords(e.coordinate, oppositeCorner);
      const newRadius = newDiag.s12 / 2;
      const newCenter = getCoordsFromHeadingAndDistance(e.coordinate, newDiag.azi1, newRadius);
      const cDelta = getHeadingAndDistanceFromCoords(this.center, newCenter);
      if (cDelta.s12 - delta.s12 / 2 > 1) {
        console.log(`Off by ${cDelta.s12 - delta.s12 / 2}m`);
        error('Geometry is too large!');
        return;
      }
      const rectangleProportionAngle = AngDiff(
        this.heading,
        getHeadingAndDistanceFromCoords(newCenter, e.coordinate).azi1
      );
      if (rectangleProportionAngle < -90 || rectangleProportionAngle > 0) {
        return;
      }
      const newHeight = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle + 180, newRadius)
      ).s12;
      const newWidth = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle, newRadius)
      ).s12;
      if (newHeight > 1 && newWidth > 1) {
        this.updateInternal(newCenter, newHeight, newWidth, null, null);
      }
    });
    this.resizeHandleTRInteraction.on('translateend', this.doneMoving);

    // center left
    this.resizeHandleCLFeature = new OlFeature({});
    this.features.push(this.resizeHandleCLFeature);

    // center right
    this.resizeHandleCRFeature = new OlFeature({});
    this.features.push(this.resizeHandleCRFeature);

    // bottom left
    this.resizeHandleBLFeature = new OlFeature({});
    this.features.push(this.resizeHandleBLFeature);

    this.resizeHandleBLInteraction = new OlTranslate({
      features: new OlCollection([this.resizeHandleBLFeature], { unique: true })
    });
    this.resizeHandleBLInteraction.on('translating', (e) => {
      const delta = getHeadingAndDistanceFromCoords(this.getCoord('BL'), e.coordinate);
      const oppositeCorner = this.getCoord('TR');
      const newDiag = getHeadingAndDistanceFromCoords(e.coordinate, oppositeCorner);
      const newRadius = newDiag.s12 / 2;
      const newCenter = getCoordsFromHeadingAndDistance(e.coordinate, newDiag.azi1, newRadius);
      const cDelta = getHeadingAndDistanceFromCoords(this.center, newCenter);
      if (cDelta.s12 - delta.s12 / 2 > 1) {
        console.log(`Off by ${cDelta.s12 - delta.s12 / 2}m`);
        error('Geometry is too large!');
        return;
      }
      const rectangleProportionAngle = AngDiff(
        this.heading,
        getHeadingAndDistanceFromCoords(newCenter, e.coordinate).azi1
      );
      if (rectangleProportionAngle > 180 || rectangleProportionAngle < 90) {
        return;
      }
      const newHeight = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle + 180, newRadius)
      ).s12;
      const newWidth = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle, newRadius)
      ).s12;
      if (newHeight > 1 && newWidth > 1) {
        this.updateInternal(newCenter, newHeight, newWidth, null, null);
      }
    });
    this.resizeHandleBLInteraction.on('translateend', this.doneMoving);

    // bottom center
    this.resizeHandleBCFeature = new OlFeature({});
    this.features.push(this.resizeHandleBCFeature);

    // bottom right
    this.resizeHandleBRFeature = new OlFeature({});
    this.features.push(this.resizeHandleBRFeature);

    this.resizeHandleBRInteraction = new OlTranslate({
      features: new OlCollection([this.resizeHandleBRFeature], { unique: true })
    });
    this.resizeHandleBRInteraction.on('translating', (e) => {
      const delta = getHeadingAndDistanceFromCoords(this.getCoord('BR'), e.coordinate);
      const oppositeCorner = this.getCoord('TL');
      const newDiag = getHeadingAndDistanceFromCoords(e.coordinate, oppositeCorner);
      const newRadius = newDiag.s12 / 2;
      const newCenter = getCoordsFromHeadingAndDistance(e.coordinate, newDiag.azi1, newRadius);
      const cDelta = getHeadingAndDistanceFromCoords(this.center, newCenter);
      if (cDelta.s12 - delta.s12 / 2 > 1) {
        console.log(`Off by ${cDelta.s12 - delta.s12 / 2}m`);
        error('Geometry is too large!');
        return;
      }
      const rectangleProportionAngle = AngDiff(
        this.heading,
        getHeadingAndDistanceFromCoords(newCenter, e.coordinate).azi1
      );
      if (rectangleProportionAngle > -90 || rectangleProportionAngle < -180) {
        return;
      }
      const newHeight = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle + 180, newRadius)
      ).s12;
      const newWidth = getHeadingAndDistanceFromCoords(
        e.coordinate,
        getCoordsFromHeadingAndDistance(newCenter, this.heading + rectangleProportionAngle, newRadius)
      ).s12;
      if (newHeight > 1 && newWidth > 1) {
        this.updateInternal(newCenter, newHeight, newWidth, null, null);
      }
    });
    this.resizeHandleBRInteraction.on('translateend', this.doneMoving);

    // Add last so it will be on top?? Doesn't work?
    this.features.push(this.moveHandleFeature);

    // this.updateInternal([longitude, latitude], height, width, heading, separation);
    this.updateInternal();
  }

  update(latitude, longitude, height, width, heading, separation) {
    if (this.rectangleFeature == null) {
      this.create(latitude, longitude, height, width, heading, separation);
      return;
    }
    this.updateInternal([longitude, latitude], height, width, heading, separation);
  }

  addInteractively(setInteraction) {
    if (this.rectangleFeature !== null) {
      console.error('RectangleSurveyMarker: called addInteractively() but already have RectangleFeature');
      return;
    }
    // Create interaction
    const addBoxInteraction = new OlDraw({
      source: this.layer.getSource(),
      type: 'Circle',
      geometryFunction: OlCreateBox()
    });
    addBoxInteraction.on('drawend', (event) => {
      setInteraction();
      const feat = event.feature;
      this.features.clear();
      this.createFromBox(feat);
    });

    setInteraction(addBoxInteraction, 'crosshair');
  }

  remove() {
    if (this.rectangleFeature === null) {
      console.error('RectangleSurveyMarker: called remove() but dont have rectangleFeature');
      return;
    }
    this.disableEdit();
    this.hide();
    this.layerCollection.remove(this.layer);
    this.map.render();
  }

  enableEdit() {
    if (this.rectangleFeature === null) {
      console.error('RectangleSurveyMarker: called enableEdit() but dont have rectangleFeature');
      return;
    }
    if (!this.moveHandleInteraction) {
      console.error('RectangleSurveyMarker: called enableEdit() but dont have moveRectangleInteraction');
      return;
    }

    this.map.addInteraction(this.separationHandleInteraction);
    this.separationHandleFeature.set('enabled', true);

    this.map.addInteraction(this.rotateHandleInteraction);
    this.rotateHandleFeature.set('enabled', true);

    this.map.addInteraction(this.resizeHandleTLInteraction);
    this.resizeHandleTLFeature.set('enabled', true);
    // this.resizeHandleTCFeature.set('enabled', true);
    this.map.addInteraction(this.resizeHandleTRInteraction);
    this.resizeHandleTRFeature.set('enabled', true);
    // this.resizeHandleCLFeature.set('enabled', true);
    // this.resizeHandleCRFeature.set('enabled', true);
    this.map.addInteraction(this.resizeHandleBLInteraction);
    this.resizeHandleBLFeature.set('enabled', true);
    // this.resizeHandleBCFeature.set('enabled', true);
    this.map.addInteraction(this.resizeHandleBRInteraction);
    this.resizeHandleBRFeature.set('enabled', true);

    // The one you add last will go on "top" essentially and be the default when they overlap - the interaction layers are also separate from the visible layers
    this.map.addInteraction(this.moveHandleInteraction);
    this.moveHandleFeature.set('enabled', true);
  }

  disableEdit() {
    if (this.rectangleFeature === null) {
      console.error('RectangleSurveyMarker: called disableEdit() but dont have rectangleFeature');
      return;
    }
    if (!this.moveHandleInteraction) {
      console.error('RectangleSurveyMarker: called disableEdit() but dont have moveRectangleInteraction');
      return;
    }
    // TODO hide handles?
    this.map.removeInteraction(this.moveHandleInteraction);
    this.moveHandleFeature.set('enabled', false);

    this.map.removeInteraction(this.resizeHandleTLInteraction);
    this.resizeHandleTLFeature.set('enabled', false);
    // this.resizeHandleTCFeature.set('enabled', false);
    this.map.removeInteraction(this.resizeHandleTRInteraction);
    this.resizeHandleTRFeature.set('enabled', false);
    // this.resizeHandleCLFeature.set('enabled', false);
    this.resizeHandleCRFeature.set('enabled', false);
    this.map.removeInteraction(this.resizeHandleBLInteraction);
    this.resizeHandleBLFeature.set('enabled', false);
    // this.resizeHandleBCFeature.set('enabled', false);
    this.map.removeInteraction(this.resizeHandleBRInteraction);
    this.resizeHandleBRFeature.set('enabled', false);

    this.map.removeInteraction(this.rotateHandleInteraction);
    this.rotateHandleFeature.set('enabled', false);

    this.map.removeInteraction(this.separationHandleInteraction);
    this.separationHandleFeature.set('enabled', false);
  }

  show() {
    this.layer.setVisible(true);
  }

  hide() {
    this.layer.setVisible(false);
  }

  setVisible(visible) {
    this.layer.setVisible(visible);
  }

  updateInternal(center = null, height = null, width = null, heading = null, separation = null) {
    if (height !== null && (height < 1 || height > 100000)) {
      console.log(`Invalid height: ${height}`);
      return;
    }
    if (width !== null && (width < 1 || width > 100000)) {
      console.log(`Invalid width: ${width}`);
      return;
    }
    if (height) {
      this.height = height;
    }
    if (width) {
      this.width = width;
    }
    if (center) this.center = center;
    if (heading !== null) this.heading = heading;
    if (separation && separation > 1 && separation < this.width) this.separation = separation;

    this.rectangleFeature.setGeometry(
      new OlPolygon([
        [
          this.getCoord('BL'),
          this.getCoord('BC'),
          this.getCoord('BR'),
          this.getCoord('CR'),
          this.getCoord('TR'),
          this.getCoord('TC'),
          this.getCoord('TL'),
          this.getCoord('CL'),
          this.getCoord('BL')
        ]
      ])
    );

    this.moveHandleFeature.setGeometry(new OlPoint(this.center));

    this.resizeHandleTLFeature.setGeometry(new OlPoint(this.getCoord('TL')));
    this.resizeHandleTCFeature.setGeometry(new OlPoint(this.getCoord('TC')));
    this.resizeHandleTRFeature.setGeometry(new OlPoint(this.getCoord('TR')));
    this.resizeHandleCLFeature.setGeometry(new OlPoint(this.getCoord('CL')));
    this.resizeHandleCRFeature.setGeometry(new OlPoint(this.getCoord('CR')));
    this.resizeHandleBLFeature.setGeometry(new OlPoint(this.getCoord('BL')));
    this.resizeHandleBCFeature.setGeometry(new OlPoint(this.getCoord('BC')));
    this.resizeHandleBRFeature.setGeometry(new OlPoint(this.getCoord('BR')));

    this.rotateHandleFeature.setGeometry(new OlPoint(this.getCoord('ROT')));

    this.separationHandleFeature.setGeometry(new OlPoint(this.getCoord('SEP')));

    this.updateGhostBots();
    this.features.changed();
    this.map.render();
  }

  doneMoving() {
    if (this.onChangeCallback) {
      this.onChangeCallback(this);
    }
    // TODO detect clicks with no edits
    if (this.onClick) {
      this.onClick();
    }
  }

  getExtent() {
    return this.layer.getSource().getExtent();
  }

  updateGhostBots() {
    for (let i = 0; i < this.ghostBotFeatures.length; i += 1) {
      this.features.remove(this.ghostBotFeatures[i]);
    }
    const geometry = new RectangleSurveyGeometry(
      this.center,
      this.height,
      this.width,
      this.heading,
      this.separation,
      this.numberOfGhostBots
    );
    this.ghostBotFeatures = [];
    const ghostFormations = geometry.getFormations();
    ghostFormations.forEach((formation) => {
      for (let i = 0; i < this.numberOfGhostBots; i += 1) {
        const feature = new OlFeature({
          geometry: new OlPoint(formation.getBotCoords(i))
        });
        feature.setStyle(
          new OlStyle({
            image: new OlCircleStyle({
              fill: new OlFill({
                color: 'black'
              }),
              radius: 5
            }),
            zIndex: -1
          })
        );
        this.ghostBotFeatures.push(feature);
        this.features.push(feature);
      }
    });
  }
}
