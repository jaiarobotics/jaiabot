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
import OlPolygon from 'ol/geom/Polygon';
import OlStyle from 'ol/style/Style';
import OlText from 'ol/style/Text';
import OlFill from 'ol/style/Fill';
import OlStroke from 'ol/style/Stroke';
import OlCircleStyle from 'ol/style/Circle';
import { asArray as colorAsArray } from 'ol/color';

import { getCoordsFromHeadingAndDistance, getHeadingAndDistanceFromCoords } from '../../common/GeoMath';

import shapes from './shapes';

// For transforming clicked coordinates to lat/long from the Mercator coordinate system
import { fromLonLat, getTransform } from 'ol/proj';
const mercator = 'EPSG:3857'
const equirectangular = 'EPSG:4326'
const equirectangular_to_mercator = getTransform(equirectangular, mercator);
const mercator_to_equirectangular = getTransform(mercator, equirectangular);

const {
  getCoordsFromHeadingAndPixelDistance, getBoatStyle, getOriginHeadingStyle, getAnnotatedLineStyle
} = shapes;

export default class HeadingControlMarker {
  constructor(id, map, layerCollection, headingCallback, distanceCallback, fillColor = '#2073BA', onClick = null) {
    this.id = id;
    this.map = map;
    this.layerCollection = layerCollection;
    this.headingCallback = headingCallback;
    this.distanceCallback = distanceCallback;
    this.onClick = onClick;
    this.color = fillColor;

    this.features = new OlCollection([], { unique: true });
    this.layer = new OlVectorLayer({
      name: this.id.toString(),
      source: new OlVectorSource({
        wrapX: false,
        features: this.features
      }),
      // Hopefully this speeds up rendering
      renderMode: 'image'
    });

    this.originFeature = null;
    this.originHeadingFeature = null;
    this.lineFeature = null;

    this.heading = 0;
    this.distance = 80; // px

    this.updatePaused = false;

    this.headingOffset = getCoordsFromHeadingAndPixelDistance([0, 0], this.heading, this.distance, this.map);

    this.layerCollection.push(this.layer);

    this.originFeatureCollection = new OlCollection([], { unique: true });
    this.originHeadingFeatureCollection = new OlCollection([], { unique: true });

    this.moveHeadingInteraction = new OlTranslate({
      features: this.originHeadingFeatureCollection
    });
    this.moveHeadingInteraction.on('translatestart', (e) => {
      this.updatePaused = true;
    });
    
    this.moveHeadingInteraction.on('translating', (e) => {
      this.updatePaused = true;
      this.setHeadingCoords(mercator_to_equirectangular(e.coordinate), false);
      // this.quickUpdateHeadingCoords(e.features[0].getGeometry().getCoordinates());
      this.map.render();
    });
    this.moveHeadingInteraction.on('translateend', (e) => {
      this.updatePaused = false;
      this.setHeadingCoords(mercator_to_equirectangular(e.coordinate));
      this.map.render();
      if (this.onClick !== null) {
        this.onClick(e);
      }
    });
  }

  create(latitude, longitude, heading) {
    const feature = new OlFeature({
      geometry: new OlPoint([longitude, latitude])
    });
    this.features.push(feature);
    this.createFromFeature(feature, heading);
  }

  createFromFeature(originFeature, heading) {
    this.originFeature = originFeature;
    this.originFeature.setId(`${this.id}`);
    // this.originFeature.setStyle(getBoatStyle(this.map, this.color));
    this.originFeature.setStyle([]);
    this.originFeatureCollection.push(this.originFeature);

    this.heading = heading;

    this.originFeature.set('heading', heading);

    const originCoords = this.originFeature.getGeometry().getCoordinates();

    const headingCoords = getCoordsFromHeadingAndPixelDistance(originCoords, heading, this.distance, this.map);
    if (headingCoords) this.headingOffset = [headingCoords[0] - originCoords[0], headingCoords[1] - originCoords[1]];

    this.originHeadingFeature = new OlFeature({
      geometry: new OlPoint(headingCoords)
    });
    
    this.originHeadingFeature.setId(`${this.id}_originHeading`);
    this.originHeadingFeature.setStyle(getOriginHeadingStyle(this.map, this.color, 'heading'));
    this.originHeadingFeature.set('heading', this.heading);

    this.features.push(this.originHeadingFeature);
    this.originHeadingFeatureCollection.push(this.originHeadingFeature);

    this.lineFeature = new OlFeature({
      geometry: new OlLineString([originCoords, headingCoords])
    });

    this.lineFeature.setStyle(getAnnotatedLineStyle(this.map, 5, this.color));

    this.lineFeature.set('heading', this.heading);
    // this.lineFeature.set('distance', this.distance);

    this.features.push(this.lineFeature);
  }

  update(latitude, longitude, heading) {
    if (this.originFeature == null) {
      this.create(latitude, longitude, heading);
      return;
    }
    if (this.updatePaused) return;
    this.setOriginCoords([longitude, latitude], true);
    this.setHeadingAziDist(heading, this.distance, true);
  }

  remove() {
    if (this.originFeature === null) {
      console.error('HeadingControlMarker: called remove() but dont have originFeature');
      return;
    }
    this.disableEdit();
    this.hide();
    this.layerCollection.remove(this.layer);
    this.map.render();
  }

  enableEdit() {
    if (this.originFeature === null) {
      console.error('HeadingControlMarker: called enableEdit() but dont have originFeature');
      return;
    }
    if (!this.moveHeadingInteraction) {
      console.error('HeadingControlMarker: called enableEdit() but dont have moveHeadingInteraction');
      return;
    }
    this.map.addInteraction(this.moveHeadingInteraction);
    this.originHeadingFeature.set('draggable', true);
  }

  disableEdit() {
    if (this.originFeature === null) {
      console.error('HeadingControlMarker: called disableEdit() but dont have originFeature');
      return;
    }
    if (!this.moveHeadingInteraction) {
      console.error('HeadingControlMarker: called disableEdit() but dont have moveHeadingInteraction');
      return;
    }
    this.map.removeInteraction(this.moveHeadingInteraction);
    this.originHeadingFeature.set('draggable', false);
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

  isVisible() {
    return this.layer.getVisible();
  }

  // PRIVATE
  setOriginCoords(latLon, external = false) {
    let coords = equirectangular_to_mercator(latLon)
  
    if (this.updatePaused) return;
    // Update origin coords
    this.originFeature.getGeometry().setCoordinates(coords);
    // Update heading point coords
    const headingCoords = getCoordsFromHeadingAndPixelDistance(coords, this.heading, this.distance, this.map);
    if (headingCoords) {
      this.originHeadingFeature.getGeometry().setCoordinates(headingCoords);
      this.lineFeature.getGeometry().setCoordinates([coords, headingCoords]);
    } else {
      // Don't update?
    }
    this.layer.changed();
    this.map.render();
  }

  // PRIVATE
  // setHeadingCoords
  //   coords are lat/long in degrees
  setHeadingCoords(latLon, done = true) {
    let coords = equirectangular_to_mercator(latLon)

    // Update heading point coords
    this.originHeadingFeature.getGeometry().setCoordinates(coords)
    const originCoords = this.originFeature.getGeometry().getCoordinates()
    const { azi1, s12 } = getHeadingAndDistanceFromCoords(mercator_to_equirectangular(originCoords), mercator_to_equirectangular(coords))
    // Update heading
    this.heading = azi1;
    // Update offset
    this.headingOffset = [coords[0] - originCoords[0], coords[1] - originCoords[1]];
    // Rotate heading marker
    this.originHeadingFeature.set('heading', this.heading);
    this.lineFeature.set('heading', this.heading);
    // this.lineFeature.set('distance', this.distance);
    this.lineFeature.getGeometry().setCoordinates([originCoords, coords]);
    if (done) {
      this.headingCallback(this.heading);
    }
    this.layer.changed();
    this.map.render();
  }

  // PRIVATE
  setHeadingAziDist(azi1, s12, external = true) {
    // Update heading point coords
    const originCoords = this.originFeature.getGeometry().getCoordinates();
    // Update heading
    this.heading = azi1;
    // Update distance
    // this.distance = s12;
    // if (this.distance < 1) this.distance = 1;
    this.originFeature.set('heading', this.heading);
    const coords = getCoordsFromHeadingAndPixelDistance(originCoords, azi1, this.distance, this.map);
    if (coords) {
      this.originHeadingFeature.getGeometry().setCoordinates(coords);
      // Update offset
      this.headingOffset = [coords[0] - originCoords[0], coords[1] - originCoords[1]];
      // Rotate heading marker
      this.originHeadingFeature.set('heading', this.heading);
      this.lineFeature.set('heading', this.heading);
      // this.lineFeature.set('distance', this.distance);
      this.lineFeature.getGeometry().setCoordinates([originCoords, coords]);
      if (!external) {
        this.headingCallback(this.heading);
      }
    } else {
      // Nothing to do?
      console.log('Unable to calculate heading coords - offscreen?');
    }
    this.layer.changed();
    this.map.render();
  }

  getOriginCoords() {
    return this.originFeature.getGeometry().getCoordinates();
  }

  getHeading() {
    return { heading: this.heading };
  }

  getExtent() {
    return this.layer.getSource().getExtent();
  }
  
  debug(title) {
    console.log(title)
    if (this.originFeature) {
      console.log('  origin  = ' + this.originFeature.getGeometry().getCoordinates())
    }
    if (this.originHeadingFeature) {
      console.log('  heading = ' + this.originHeadingFeature.getGeometry().getCoordinates())
    }
  }
  
}
