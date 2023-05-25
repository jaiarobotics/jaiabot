import { Map } from "ol"
import { Coordinate } from "ol/coordinate"
import { toLonLat } from "ol/proj"
import { GeographicCoordinate } from "./shared/JAIAProtobuf"

let abs = Math.abs

export function formatLatitude(lat: number, prec=5) {
    if (lat == null) {
        return "?"
    } 
    if (lat > 0) {
        return abs(lat).toFixed(prec) + "° N"
    }
    else {
        return abs(lat).toFixed(prec) + "° S"
    }
}

export function formatLongitude(lon: number, prec=5) {
    if (lon == null) {
        return "?"
    } 
    if (lon > 0) {
        return abs(lon).toFixed(prec) + "° E"
    }
    else {
        return abs(lon).toFixed(prec) + "° W"
    }
}

export function formatAttitudeAngle(angle_deg: number, prec=2) {
    if (angle_deg == null) {
        return "?"
    }
    return angle_deg.toFixed(prec) + '°'
}

export function deepcopy<T>(aObject: T): T {
    // Prevent undefined objects
    // if (!aObject) return aObject;
  
    let bObject: any = Array.isArray(aObject) ? [] : {};
  
    let value;
    for (const key in aObject) {
  
      // Prevent self-references to parent object
      // if (Object.is(aObject[key], aObject)) continue;
      
      value = aObject[key];
  
      bObject[key] = (typeof value === "object") ? deepcopy(value) : value;
    }
  
    return bObject;
}

export function areEqual(a: any, b: any) {
    return JSON.stringify(a) == JSON.stringify(b)
}

export function randomBase57(stringLength: number) {
    const base75Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstvwxyz'

    var s = ''
    for (let i = 0; i < stringLength; i++) {
        s = s.concat(base75Chars[Math.floor(Math.random() * base75Chars.length)])
    }
    return s
}

export function downloadToFile(data: string, mimeType: string, fileName: string) {
    const blob = new Blob([data], {type: mimeType})

    var link = window.document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    // Construct filename dynamically and set to link.download
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

// getGeographicCoordinate()
//   Returns the GeographicCoordinate of an OpenLayers coordinate on a map
//   
//   Inputs
//     coordinate: coordinate to convert
//     map: an OpenLayers map that the coordinates refer to
export function getGeographicCoordinate(coordinate: Coordinate, map: Map) {
    const lonLat = toLonLat(coordinate, map.getView().getProjection())
    const geographicCoordinate: GeographicCoordinate = {
        lon: lonLat[0],
        lat: lonLat[1]
    }

    return geographicCoordinate
}
