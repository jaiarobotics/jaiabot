import OlCircle from 'ol/geom/Circle';
import OlMultiLineString from 'ol/geom/MultiLineString';
import OlPoint from 'ol/geom/Point';
import OlPolygon from 'ol/geom/Polygon';
import OlCircleStyle from 'ol/style/Circle';
import OlFill from 'ol/style/Fill';
import OlIcon from 'ol/style/Icon'
import OlStroke from 'ol/style/Stroke';
import OlStyle from 'ol/style/Style';
import OlText from 'ol/style/Text';

import botIcon from '../icons/bot.svg'
import botSelectedIcon from '../icons/botSelected.svg'

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
const COLOR_MISSION_DEFAULT = lessVars.missionColor;
const COLOR_GOAL = lessVars.missionGoalColor;
const COLOR_STATUS_GOOD = lessVars.goodColor;
const COLOR_STATUS_WARNING = lessVars.warningColor;
const COLOR_STATUS_ERROR = lessVars.errorColor;

function brightness(r, g, b) {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function parseColor(input) {
  if (input.substr(0, 1) == '#') {
    const collen = (input.length - 1) / 3;
    const fact = [17, 1, 0.062272][collen - 1];
    return [
      Math.round(parseInt(input.substr(1, collen), 16) * fact),
      Math.round(parseInt(input.substr(1 + collen, collen), 16) * fact),
      Math.round(parseInt(input.substr(1 + 2 * collen, collen), 16) * fact)
    ];
  }
  return input
    .split('(')[1]
    .split(')')[0]
    .split(',')
    .map(Math.round);
}

function contrastingFgFill(color) {
  const rgbColor = parseColor(color);
  const bright = brightness(rgbColor[0], rgbColor[1], rgbColor[2]);
  let outColor = 'black';
  if (bright < 110) {
    outColor = 'white';
  }
  return new OlFill({ color: outColor });
}

const defaultTextStyle = {
  font: 'bold 16px helvetica,sans-serif',
  fill: new OlFill({ color: '#FFF' }),
  stroke: new OlStroke({ color: 'black', width: 2 })
};

const handleOutlineStyle = new OlStyle({
  image: new OlCircleStyle({
    stroke: new OlStroke({ color: 'black', width: 1, lineDash: [5, 7] }),
    radius: 30
  }),
  zIndex: 100
});

// Vector shape used for bots on map
// Negative is up and left. Positive is down and right.
const arrowShape = [[0, -7], [5, -2], [2, -2], [2, 7], [-2, 7], [-2, -2], [-5, -2]];
const arrowShapeSourceSize = 14.0;

const arrowHeadShape = [[0, 0], [5, 7], [-5, 7]];
const arrowHeadShapeSourceSize = 7.0;

// These are eventually going to be dynamic
// eslint-disable-next-line prefer-const
let botSize = 65;

// eslint-disable-next-line prefer-const
let liveBotShape = arrowShape;
// eslint-disable-next-line prefer-const
let shapeSourceSize = arrowShapeSourceSize;

function getPixelBoatGeometry(map) {
  return function pixelBoatGeometry(feature) {
    const startingCoordinates = feature.getGeometry().getCoordinates();
    const pixelStart = map.getPixelFromCoordinate(startingCoordinates);
    const polyCoords = [];
    const scale = botSize / shapeSourceSize;
    for (let c = 0; c < liveBotShape.length; c += 1) {
      polyCoords.push(
        map.getCoordinateFromPixel([
          pixelStart[0] + liveBotShape[c][0] * scale,
          pixelStart[1] + liveBotShape[c][1] * scale
        ])
      );
    }
    const mapRotation = map.getView().getRotation();
    let heading = feature.get('heading') || 180;
    heading *= Math.PI;
    heading /= 180.0;
    heading += mapRotation;
    const out = new OlPolygon([polyCoords]);
    out.rotate(-heading, startingCoordinates);
    return out;
  };
}

function getCircleGeometry(map, radius) {
  return function circleGeometry(feature) {
    const startingCoordinates = feature.getGeometry().getCoordinates();
    const pixelStart = map.getPixelFromCoordinate(startingCoordinates);
    const radPoint = map.getCoordinateFromPixel([pixelStart[0] + radius, pixelStart[1]]);
    const out = new OlCircle(startingCoordinates, radPoint[0] - startingCoordinates[0], 'XY');
    return out;
  };
}

function getOriginGeometry(map, inner = 15, outer = 30) {
  return function originGeometry(feature) {
    const startingCoordinates = feature.getGeometry().getCoordinates();
    const pixelStart = map.getPixelFromCoordinate(startingCoordinates);
    const mlStringCoords = [];
    // Up
    mlStringCoords.push([
      map.getCoordinateFromPixel([pixelStart[0], pixelStart[1] + inner]),
      map.getCoordinateFromPixel([pixelStart[0], pixelStart[1] + outer])
    ]);
    // Right
    mlStringCoords.push([
      map.getCoordinateFromPixel([pixelStart[0] + inner, pixelStart[1]]),
      map.getCoordinateFromPixel([pixelStart[0] + outer, pixelStart[1]])
    ]);
    // Down
    mlStringCoords.push([
      map.getCoordinateFromPixel([pixelStart[0], pixelStart[1] - inner]),
      map.getCoordinateFromPixel([pixelStart[0], pixelStart[1] - outer])
    ]);
    // Left
    mlStringCoords.push([
      map.getCoordinateFromPixel([pixelStart[0] - inner, pixelStart[1]]),
      map.getCoordinateFromPixel([pixelStart[0] - outer, pixelStart[1]])
    ]);
    const out = new OlMultiLineString(mlStringCoords);
    return out;
  };
}

function getHeadingVectorGeometry(map) {
  return function headingVectorGeometry(feature) {
    const startingCoordinates = feature.getGeometry().getCoordinates();
    const pixelStart = map.getPixelFromCoordinate(startingCoordinates);
    const polyCoords = [];
    const scale = 15 / arrowHeadShapeSourceSize;
    for (let c = 0; c < arrowHeadShape.length; c += 1) {
      polyCoords.push(
        map.getCoordinateFromPixel([
          pixelStart[0] + arrowHeadShape[c][0] * scale,
          pixelStart[1] + arrowHeadShape[c][1] * scale
        ])
      );
    }
    const mapRotation = map.getView().getRotation();
    let heading = feature.get('heading') || 0;
    heading *= Math.PI;
    heading /= 180.0;
    heading += mapRotation;
    const out = new OlPolygon([polyCoords]);
    out.rotate(-heading, startingCoordinates);
    return out;
  };
}

export default {
  getCoordsFromHeadingAndPixelDistance: function getCoordsFromHeadingAndPixelDistance(coords1, azi1, s12, map) {
    if (s12 === 0) return coords1;
    if (coords1[0] === 0 && coords1[1] === 0) return coords1;
    // Pixels are relative to the screen and not the map so we need to account for map view rotation
    const mapRotation = map.getView().getRotation();
    const pixelOrigin = map.getPixelFromCoordinate(coords1);
    if (!pixelOrigin) {
      // Off screen
      console.log('Unable to calculate heading coords - offscreen?');
      return null;
    }
    const headingPoint = map.getCoordinateFromPixel([pixelOrigin[0], pixelOrigin[1] - s12]);
    const out = new OlPoint(headingPoint);
    out.rotate((-azi1 * Math.PI) / 180.0 - mapRotation, coords1);
    return out.getCoordinates();
  },
  /*
  geoBoatGeometry: function geoBoatGeometry(feature) {
    const startingCoordinates = feature.getGeometry().getCoordinates();
    const coordinates = [];
    const scale = botSize / shapeSourceSize;
    for (let c = 0; c < liveBotShape.length; c += 1) {
      coordinates.push(
        map.getCoordinateFromPixel([
          startingCoordinates[0] + liveBotShape[c][0] * scale,
          startingCoordinates[1] + liveBotShape[c][1] * scale
        ])
      );
    }
    return new OlPolygon([coordinates]);
  },
    */

  getBoatStyle: function getBoatStyle(map, fillColor = COLOR_STATUS_GOOD) {
    return function boatStyle(feature, resolution) {
      // font size
      let fontSize;
      if (resolution > 0.4)
        fontSize = '8pt';
      else
        fontSize = '10pt';

      const defaultFill = new OlFill({ color: fillColor });
      const selectedFill = new OlFill({ color: COLOR_SELECTED });
      const fadedFill = new OlFill({ color: COLOR_INACTIVE });
      const faultFill = new OlFill({ color: COLOR_STATUS_ERROR });
      const warnFill = new OlFill({ color: COLOR_STATUS_WARNING });
      const controlledFill = new OlFill({ color: COLOR_CONTROLLED });
      const trackedFill = new OlFill({ color: COLOR_TRACKED });
      const driftFill = new OlFill({ color: COLOR_MEASURE_DRIFT });
      const doneFill = new OlFill({ color: '#0000FF' });
      const remoteControlFill = new OlFill({color : '#a16da3'})
      let fill = defaultFill;

      const defaultStroke = new OlStroke({ color: 'black', width: 2 });
      const dottedStroke = new OlStroke({ color: 'black', width: 2, lineDash: [5, 7] });
      let stroke = defaultStroke;

      const defaultGeometry = getPixelBoatGeometry(map);
      const circleGeometry = getCircleGeometry(map, 20);
      let geometry = defaultGeometry;

      // const heading = Math.round(feature.get('heading')).toString() || '-';

      const rfState = parseInt(feature.get('commState') || 0, 10);
      const faultState = parseInt(feature.get('faultState') || 0, 10);
      // const commandState = parseInt(feature.get('commandState') || 0, 10);
      const batteryState = parseInt(feature.get('batteryState') || 0, 10);
      const otherState = parseInt(feature.get('otherMarker') || 0, 10);

      const selected = feature.get('selected') === true;
      const controlled = feature.get('controlled') === true;
      const tracked = feature.get('tracked') === true;
      const completed = feature.get('completed') === true;
      const remoteControlled = feature.get('remoteControlled') === true

      // Serious faults
      if (rfState >= 2 || faultState === 6) {
        // Loss of comms
        stroke = dottedStroke;
        fill = fadedFill;
        geometry = circleGeometry;
      } else if (rfState === 1) {
        // Late comms
        stroke = dottedStroke;
        fill = fadedFill;
      } else if ((faultState >= 4 && faultState !== 7) || batteryState >= 7) {
        // Bot failure
        fill = faultFill;
        geometry = circleGeometry;
      } else {
        // Minor faults and other states
        if ((faultState >= 2 && faultState !== 7) || batteryState >= 4) {
          // Low battery or payload issue
          fill = warnFill;
        }
        if (otherState === 1) {
          // Diving
          geometry = circleGeometry;
        } else if (otherState === 2) {
          // Drifting on purpose
          stroke = dottedStroke;
          // What should this be?
          // Circle indicates no heading, which is not the case
          // Dotted stroke means no location, which is also not the case
          // Leaving as normal for now
        } else if (otherState === 3) {
          // waiting for gps
          stroke = dottedStroke;
          geometry = circleGeometry;
        }
      }

      if (fill === defaultFill) {
        if (controlled) {
          fill = controlledFill;
        } else if (tracked) {
          fill = trackedFill;
        } else if (completed) {
          fill = doneFill;
        }
      }

      if (selected && !controlled) {
        fill = selectedFill;
      }

      if (remoteControlled) {
        fill = remoteControlFill
      }

      // SVG icon
      let rotation = (feature.get('heading') || 180) * (Math.PI / 180.0)
      var icon = botIcon

      if (selected) {
        icon = botSelectedIcon
      }

      let defaultBoatStyle = new OlStyle({
        image : new OlIcon(
            {src : icon, rotation : rotation, rotateWithView : true}),
        text : new OlText({
          font : `bold ${fontSize} helvetica,sans-serif`,
          text : `${feature.getId()}`,
          fill : contrastingFgFill(fill.getColor()),
          overflow : true
        })
      })

      return defaultBoatStyle

      return [
        new OlStyle({
          fill,
          stroke,
          text: new OlText({
            font: `bold ${fontSize} helvetica,sans-serif`,
            text: `${feature.getId()}`,
            fill: contrastingFgFill(fill.getColor()),
            overflow: true
          }),
          geometry
        })
      ];
    };
  },

  getWaypointStyle: function getWaypointStyle(fillColor = '#2073BA') {
    return function waypointStyle(feature, resolution) {
      // font size
      let fontSize;
      if (resolution > 0.4) fontSize = '8px';
      else fontSize = '10px';

      // const heading = Math.round(feature.get('heading')).toString() || '-';

      const isDraggable = feature.get('draggable') || false;

      const styles = [
        new OlStyle({
          text: new OlText({
            ...defaultTextStyle,
            text: `${feature.getId()}`,
            overflow: true
          }),
          image: new OlCircleStyle({
            fill: new OlFill({ color: fillColor }),
            stroke: new OlStroke({ color: 'black', width: 2 }),
            radius: 10
          })
        })
      ];
      if (isDraggable) {
        styles.push(handleOutlineStyle);
      }
      return styles;
    };
  },
  getHandleStyle: function getHandleStyle(fillColor = '#2073BA') {
    return function handleStyle(feature, resolution) {
      const isVisible = feature.get('enabled') || false;
      if (isVisible) {
        return [
          new OlStyle({
            image: new OlCircleStyle({
              fill: new OlFill({ color: fillColor }),
              stroke: new OlStroke({ color: 'black', width: 2 }),
              radius: 10
            })
          }),
          handleOutlineStyle
        ];
      }
      return [];
    };
  },
  getOriginStyle: function getOriginStyle(map, fillColor = '#2073BA', edgeColor = 'black') {
    return function originStyle(feature, resolution) {
      const isDraggable = feature.get('draggable') || false;
      const styles = [
        /*
        new OlStyle({
          text: new OlText({
            ...defaultTextStyle,
            text: `${feature.getId()}`,
            overflow: true
          }),
          image: new OlCircleStyle({
            fill: new OlFill({ color: fillColor }),
            // stroke: new OlStroke({ color: edgeColor, width: 1 }),
            radius: 20
          }),
          zIndex: 20
        }),
        */
        new OlStyle({
          fill: new OlFill({ color: fillColor }),
          stroke: new OlStroke({ color: edgeColor, width: 1 }),
          geometry: getOriginGeometry(map, 15, 30),
          zIndex: 20
        })
      ];
      if (isDraggable) {
        styles.push(handleOutlineStyle);
      }
      return styles;
    };
  },
  getOriginHeadingStyle: function getOriginHeadingStyle(map, fillColor = '#2073BA', shape = 'line') {
    return function originHeadingStyle(feature, resolution) {
      const isDraggable = feature.get('draggable') || false;
      let heading = feature.get('heading') || false;
      if (heading) {
        heading = Math.round(heading);
      }
      let distance = feature.get('distance') || false;
      if (distance) {
        distance = Math.round(distance);
      }
      const styles = [];
      /* Omitting because arrow doesn't point the right way at init or if the map is rotated
      if (shape === 'line') {
        styles.push(
          new OlStyle({
            fill: new OlFill({ color: fillColor }),
            stroke: new OlStroke({ color: fillColor, width: 1 }),
            geometry: getHeadingVectorGeometry(map),
            zIndex: 20
          })
        );
      }
      */
      if (isDraggable) {
        styles.push(handleOutlineStyle);
      }
      /*
      if (heading) {
        styles.push(
          new OlStyle({
            text: new OlText({
              text: `${heading} deg`,
              ...defaultTextStyle,
              overflow: true,
              offsetX: 40,
              offsetY: 40
            })
          })
        );
      }
      if (distance) {
        styles.push(
          new OlStyle({
            text: new OlText({
              ...defaultTextStyle,
              text: `${distance} m`,
              overflow: true,
              offsetX: -40,
              offsetY: -40
            })
          })
        );
      }
        */
      return styles;
    };
  },
  getAnnotatedLineStyle: function getAnnotatedStyle(map, width = 2, fillColor = '#2073BA') {
    return function annotatedStyle(feature, resolution) {
      const heading = feature.get('heading') || false;
      let textAngle = heading;
      const distance = Math.round(feature.get('distance')) || false;

      const coords = feature.getGeometry().getCoordinates();
      const pt1 = map.getPixelFromCoordinate(coords[0]);
      const pt2 = map.getPixelFromCoordinate(coords[1]);

      const pixelLength = Math.sqrt((pt2[0] - pt1[0]) ** 2 + (pt2[1] - pt1[1]) ** 2);

      if (pixelLength < 15) {
        return [];
      }

      const styles = [
        new OlStyle({
          fill: new OlFill({ color: fillColor }),
          stroke: new OlStroke({ color: fillColor, width, lineDash: [10, 20] })
        })
      ];
      if (heading) {
        if (heading > 0) {
          textAngle = ((heading - 90.0) * Math.PI) / 180.0;
        } else {
          textAngle = ((heading + 90.0) * Math.PI) / 180.0;
        }
        styles.push(
          new OlStyle({
            text: new OlText({
              text: `${Math.round(heading)} deg`,
              ...defaultTextStyle,
              overflow: true,
              offsetY: 20,
              rotation: textAngle
            })
          })
        );
      }
      if (distance) {
        styles.push(
          new OlStyle({
            text: new OlText({
              ...defaultTextStyle,
              text: `${distance} m`,
              overflow: true,
              offsetY: -20,
              rotation: heading ? textAngle : 0 // In this case 0 being falsy is fine
            })
          })
        );
      }
      return styles;
    };
  },
  getClientPositionStyle() {
    return new OlStyle({
      image: new OlCircleStyle({
        radius: 6,
        fill: new OlFill({
          color: '#3399CC'
        }),
        stroke: new OlStroke({
          color: '#fff',
          width: 2
        })
      })
    });
  }
};
