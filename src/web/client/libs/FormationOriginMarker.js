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

import shapes from './shapes';

import { getCoordsFromHeadingAndDistance, getHeadingAndDistanceFromCoords } from '../../common/GeoMath';
import FormationGeometry from '../../common/FormationGeometry';

const { getOriginStyle } = shapes;
const { getOriginHeadingStyle } = shapes;
const { getAnnotatedLineStyle } = shapes;

// To transform to the map's projection
import { fromLonLat, getTransform } from 'ol/proj';
const equirectangular = 'EPSG:4326'

export default class FormationOriginMarker {
  constructor(
    id,
    shape,
    map,
    layerCollection,
    coordsCallback,
    headingCallback,
    distanceCallback,
    fillColor = '#2073BA',
    onClick = null
  ) {
    this.id = id;
    this.shape = shape;
    this.map = map;
    this.layerCollection = layerCollection;
    this.coordsCallback = coordsCallback;
    this.headingCallback = headingCallback;
    this.distanceCallback = distanceCallback;
    this.onClick = onClick;
    this.color = fillColor;
    this.transform = getTransform(equirectangular, map.getView().getProjection())
    this.inverseTransform = getTransform(map.getView().getProjection(), equirectangular)

    this.numberOfGhostBots = 10;

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
    this.ghostBotFeatures = null;

    this.heading = 45;
    this.distance = 10;

    this.headingOffset = getCoordsFromHeadingAndDistance([0, 0], this.heading, this.distance);

    this.layerCollection.push(this.layer);

    this.originFeatureCollection = new OlCollection([], { unique: true });
    this.originHeadingFeatureCollection = new OlCollection([], { unique: true });

    this.moveOriginInteraction = new OlTranslate({
      features: this.originFeatureCollection
    });
    this.moveOriginInteraction.on('translating', (e) => {
      this.quickUpdateOriginCoords(this.inverseTransform(e.coordinate));
      // this.quickUpdateOriginCoords(e.features[0].getGeometry().getCoordinates());
      this.map.render();
    });
    this.moveOriginInteraction.on('translateend', (e) => {
      this.setOriginCoords(this.inverseTransform(e.coordinate));
      this.map.render();
      if (this.onClick !== null) {
        this.onClick(e);
      }
    });

    this.moveHeadingInteraction = new OlTranslate({
      features: this.originHeadingFeatureCollection
    });
    this.moveHeadingInteraction.on('translating', (e) => {
      this.setHeadingCoords(this.inverseTransform(e.coordinate), false);
      // this.quickUpdateHeadingCoords(e.features[0].getGeometry().getCoordinates());
      this.map.render();
    });
    this.moveHeadingInteraction.on('translateend', (e) => {
      this.setHeadingCoords(this.inverseTransform(e.coordinate));
      this.map.render();
      if (this.onClick !== null) {
        this.onClick(e);
      }
    });
  }

  create(latitude, longitude, heading, distance) {
    this.originCoords = [longitude, latitude]

    const feature = new OlFeature({
      geometry: new OlPoint(this.transform(this.originCoords))
    });
    
    this.features.push(feature);
    this.createFromFeature(feature, heading, distance);
  }

  createFromFeature(originFeature, heading, distance) {
    this.originFeature = originFeature;
    this.originFeature.setId(`${this.id}`);
    this.originFeature.setStyle(getOriginStyle(this.map, this.color));
    this.originFeatureCollection.push(this.originFeature);

    this.heading = heading;
    this.distance = distance;

    if (this.distance < 1) this.distance = 1;
    
    const originCoords = this.originCoords
    const originCoordsTransformed = this.transform(originCoords)

    const headingCoords = getCoordsFromHeadingAndDistance(originCoords, heading, distance);
    const headingCoordsTransformed = this.transform(headingCoords)

    this.headingOffset = [headingCoords[0] - originCoords[0], headingCoords[1] - originCoords[1]];

    this.originHeadingFeature = new OlFeature({
      geometry: new OlPoint(headingCoordsTransformed)
    });

    this.originHeadingFeature.setId(`${this.id}_originHeading`);
    this.originHeadingFeature.setStyle(getOriginHeadingStyle(this.map, this.color, this.shape));
    this.originHeadingFeature.set('heading', this.heading);

    this.features.push(this.originHeadingFeature);
    this.originHeadingFeatureCollection.push(this.originHeadingFeature);

    this.lineFeature = new OlFeature({
      geometry: new OlLineString([originCoordsTransformed, headingCoordsTransformed])
    });

    this.lineFeature.setStyle(getAnnotatedLineStyle(this.map, 10, this.color));

    this.lineFeature.set('heading', this.heading);
    this.lineFeature.set('distance', this.distance);

    this.features.push(this.lineFeature);

    this.updateGhostBots();
  }

  update(latitude, longitude, heading, distance) {
    if (this.originFeature == null) {
      this.create(latitude, longitude, heading, distance);
      return;
    }
    this.setOriginCoords([longitude, latitude], true);
    this.setHeadingAziDist(heading, distance, true);
  }

  // TODO update to draw whole formation?
  addInteractively() {
    if (this.originFeature !== null) {
      console.error('FormationOriginMarker: called addInteractively() but dont have originFeature');
      return;
    }
    // Create interaction
    const addPointInteraction = new OlDraw({
      source: this.layer.getSource(),
      type: 'Point',
      maxPoints: 1
    });
    addPointInteraction.on('drawend', (event) => {
      this.create(event.feature, this.heading, this.distance);

      this.map.removeInteraction(addPointInteraction);
      this.enableEdit();
    });

    this.map.addInteraction(addPointInteraction);
  }

  remove() {
    if (this.originFeature === null) {
      console.error('FormationOriginMarker: called remove() but dont have originFeature');
      return;
    }
    this.disableEdit();
    this.hide();
    this.layerCollection.remove(this.layer);
    this.map.render();
  }

  enableEdit() {
    if (this.originFeature === null) {
      console.error('FormationOriginMarker: called enableEdit() but dont have originFeature');
      return;
    }
    if (!this.moveOriginInteraction) {
      console.error('FormationOriginMarker: called enableEdit() but dont have moveOriginInteraction');
      return;
    }
    this.map.addInteraction(this.moveHeadingInteraction);
    this.map.addInteraction(this.moveOriginInteraction);
    this.originHeadingFeature.set('draggable', true);
    this.originFeature.set('draggable', true);
  }

  disableEdit() {
    if (this.originFeature === null) {
      console.error('FormationOriginMarker: called disableEdit() but dont have originFeature');
      return;
    }
    if (!this.moveOriginInteraction) {
      console.error('FormationOriginMarker: called disableEdit() but dont have moveOriginInteraction');
      return;
    }
    this.map.removeInteraction(this.moveOriginInteraction);
    this.map.removeInteraction(this.moveHeadingInteraction);
    this.originFeature.set('draggable', false);
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

  quickUpdateOriginCoords(coords) {
    // Update origin coords
    this.originCoords = coords
    const transformedOrigin = this.transform(coords)
    this.originFeature.getGeometry().setCoordinates(transformedOrigin);

    // Update heading point coords
    // This does fudge the numbers a bit, but that should get corrected after the drag is done
    const headingCoords = [coords[0] + this.headingOffset[0], coords[1] + this.headingOffset[1]]
    const transformedHeading = this.transform(headingCoords)
    this.originHeadingFeature.getGeometry().setCoordinates(transformedHeading)

    const heading = this.originHeadingFeature.getGeometry().getCoordinates()

    this.lineFeature.getGeometry().setCoordinates([transformedOrigin, transformedHeading])

    this.updateGhostBots();
  }

  setOriginCoords(coords, external = false) {
    // Update origin coords
    this.originCoords = coords
    const transformedOrigin = this.transform(coords)
    this.originFeature.getGeometry().setCoordinates(transformedOrigin)

    // Update heading point coords
    const headingCoords = getCoordsFromHeadingAndDistance(coords, this.heading, this.distance)
    const transformedHeading = this.transform(headingCoords)
    this.originHeadingFeature.getGeometry().setCoordinates(transformedHeading)

    const heading = this.originHeadingFeature.getGeometry().getCoordinates()

    this.lineFeature.getGeometry().setCoordinates([transformedOrigin, transformedHeading])

    this.updateGhostBots();
    if (!external) {
      this.coordsCallback(coords);
    }
  }

  setHeadingCoords(coords, done = true) {
    // Update heading point coords
    const originCoords = this.originCoords
    const transformedOrigin = this.transform(originCoords)
    
    const transformedHeading = this.transform(coords)
    this.originHeadingFeature.getGeometry().setCoordinates(transformedHeading);

    const heading = this.originHeadingFeature.getGeometry().getCoordinates()

    const { azi1, s12 } = getHeadingAndDistanceFromCoords(originCoords, coords);
    // Update heading
    this.heading = azi1;
    // Update distance
    this.distance = s12;
    // Update offset
    this.headingOffset = [coords[0] - originCoords[0], coords[1] - originCoords[1]];
    // Rotate heading marker
    this.originHeadingFeature.set('heading', this.heading)
    this.lineFeature.set('heading', this.heading)
    this.lineFeature.set('distance', this.distance)
    
    this.lineFeature.getGeometry().setCoordinates([transformedOrigin, transformedHeading])
    
    this.updateGhostBots();
    if (done) {
      this.headingCallback(this.heading);
      this.distanceCallback(this.distance);
    }
  }

  setHeadingAziDist(azi1, s12, external = true) {
    // Update heading point coords
    // Update heading
    this.heading = azi1;
    // Update distance
    this.distance = s12;
    if (this.distance < 1) this.distance = 1;
    const originCoords = this.originCoords
    const transformedOrigin = this.transform(originCoords)
    
    const coords = getCoordsFromHeadingAndDistance(originCoords, azi1, this.distance)
    const transformedHeading = this.transform(coords)
    
    this.originHeadingFeature.getGeometry().setCoordinates(transformedHeading);

    const heading = this.originHeadingFeature.getGeometry().getCoordinates()

    // Update offset
    this.headingOffset = [coords[0] - originCoords[0], coords[1] - originCoords[1]];
    // Rotate heading marker
    this.originHeadingFeature.set('heading', this.heading);
    this.lineFeature.set('heading', this.heading);
    this.lineFeature.set('distance', this.distance);

    this.lineFeature.getGeometry().setCoordinates([transformedOrigin, transformedHeading]);

    this.updateGhostBots();
    if (!external) {
      this.headingCallback(this.heading);
      this.distanceCallback(this.distance);
    }
  }

  getOriginCoords() {
    return this.originCoords
  }

  getHeadingAndDistance() {
    return { heading: this.heading, distance: this.distance };
  }

  getExtent() {
    return this.layer.getSource().getExtent();
  }

  setShape(shape) {
    this.shape = shape;
    this.originHeadingFeature.setStyle(getOriginHeadingStyle(this.map, this.color, this.shape));
    this.updateGhostBots();
    this.map.render();
  }

  updateGhostBots() {
    const originCoords = this.originCoords
    const geometry = new FormationGeometry(
      originCoords,
      this.heading,
      this.distance,
      this.shape,
      this.numberOfGhostBots
    );
    if (this.ghostBotFeatures === null) {
      this.ghostBotFeatures = [];
      const dotColor = colorAsArray(this.color);
      for (let i = 0; i < this.numberOfGhostBots; i += 1) {
        const feature = new OlFeature({
          geometry: new OlPoint(this.transform(geometry.getBotCoords(i)))
        });
        feature.setStyle(
          new OlStyle({
            /*
            text: new OlText({
              text: `${i + 1}`,
              overflow: true,
              fill: new OlFill({ color: [255, 255, 255, 1] })
            }),
            */
            image: new OlCircleStyle({
              fill: new OlFill({
                color: [dotColor[0], dotColor[1], dotColor[2], 1 - i / (this.numberOfGhostBots * 2)]
              }),
              // fill: new OlFill({ color: this.color }),
              // stroke: new OlStroke({ color: edgeColor, width: 1 }),
              radius: 5
            }),
            zIndex: 25
          })
        );
        this.features.push(feature);
        this.ghostBotFeatures.push(feature);
      }
      return;
    }
    for (let i = 0; i < this.ghostBotFeatures.length; i += 1) {
      this.ghostBotFeatures[i].getGeometry().setCoordinates(this.transform(geometry.getBotCoords(i)));
    }
  }
}
