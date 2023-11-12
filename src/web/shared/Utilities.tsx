import { Map } from "ol"
import { Coordinate } from "ol/coordinate"
import { toLonLat, fromLonLat } from "ol/proj"
import { GeographicCoordinate } from "./JAIAProtobuf"
import { getLength as OlGetLength } from "ol/sphere"
import { Geometry} from "ol/geom"

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

export function formatAttitudeAngle(angleDegrees: number, prec=2) {
    if (angleDegrees == null) {
        return "?"
    }
    return angleDegrees.toFixed(prec) + '°'
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

export function equalValues(a: any, b: any) {
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

// getMapCoordinate()
//   Returns the OpenLayers Coordinate of an GeographicCoordinate on a map
//   
//   Inputs
//     coordinate: coordinate to convert
//     map: an OpenLayers map that the coordinates refer to
export function getMapCoordinate(coordinate: GeographicCoordinate, map: Map) {
    if (coordinate == null) return null
    return fromLonLat([coordinate.lon, coordinate.lat], map.getView().getProjection())
}

/**
 * Gets the element with a certain id
 * 
 * @param id id of the element to get
 * @returns The element, if it exists
 */
export function getElementById<T>(id: string) {
    // In case they passed a jQuery id selector in
    id = id.replaceAll('#', '')
    return document.getElementById(id) as T
}

export function addDropdownListener(targetClassName: string, parentContainerId: string, delayMS: number) {
    const dropdownContainers = Array.from(document.getElementsByClassName(targetClassName) as HTMLCollectionOf<HTMLElement>)
    dropdownContainers.forEach((dropdownElement: HTMLElement) => {
        dropdownElement.addEventListener('click', (event: Event) => handleAccordionDropdownClick(event, targetClassName, parentContainerId, delayMS))
    })
}

function handleAccordionDropdownClick(event: Event, targetClassName: string, parentContainerId: string, delayMS: number) {       
    let clickedElement = event.target as HTMLElement
    if (clickedElement.classList.contains('Mui-expanded')) {
        return
    }
    // Difficult to avoid this function being called twice on nested accoridon clicks, but having it only adjust to accordionContainers
    //     reduces some of the lag
    while (!clickedElement.classList.contains(targetClassName) && !clickedElement.classList.contains('nestedAccordionContainer')) {
        clickedElement = clickedElement.parentElement
    }
    const dropdownTimeout: number = delayMS // Milliseconds

    setTimeout(() => {
        const dropdownContainer = clickedElement
        adjustAccordionScrollPosition(parentContainerId, dropdownContainer)
    }, dropdownTimeout)
}

export function adjustAccordionScrollPosition(parentContainerId: string, dropdownContainer: HTMLElement) {
    const parentContainer = document.getElementById(parentContainerId)
    const parentContainerSpecs: DOMRect = parentContainer.getBoundingClientRect()
    const dropdownContainerSpecs: DOMRect = dropdownContainer.getBoundingClientRect()

    if (dropdownContainerSpecs.height > parentContainerSpecs.height) {
        const heightDiff = dropdownContainerSpecs.height - parentContainerSpecs.height
        parentContainer.scrollBy({
            // Subtracting heightDiff reduces scroll by number of pixels dropdownContainer is larger than botDetailsAccordionContainer
            top: dropdownContainerSpecs.bottom - parentContainerSpecs.bottom - heightDiff,
            left: 0
        })
    } else if (dropdownContainerSpecs.bottom > parentContainerSpecs.bottom) {
        parentContainer.scrollBy({
            top: dropdownContainerSpecs.bottom - parentContainerSpecs.bottom,
            left: 0
        })
    }
}

export function formatLength(line: Geometry, map: Map) {
    const length = OlGetLength(line, { projection: map.getView().getProjection() });
    if (length > 100) {
        return {magnitude: `${Math.round((length / 1000) * 100) / 100}`, unit: 'km'};
    }
    return {magnitude: `${Math.round(length * 100) / 100}`, unit: 'm'};
}

/**
 * Returns a date string in the form yyyy-mm-dd
 * @param date
 * @returns {string} 
 */
export function getHTMLDateString(date: Date) {
    const year = date.getFullYear()
    const month = date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1 // Zero-indexed (January == 0)
    const day = date.getDate() < 10 ? `0${date.getDate()}` : date.getDate()
    return `${year}-${month}-${day}`
}

/**
 * Returns a time string in the form hh:mm 
 * @param date 
 */
export function getHTMLTimeString(date: Date) {
    const hours = date.getHours() < 10 ? `0${date.getHours()}` : date.getHours()
    const mins = date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes()
    return `${hours}:${mins}`
}

/**
 * @param strDate "yyyy-mm-dd hh:mm"
 * @returns ISO str date in UTC
 * Example return value: "2023-10-18 09:04:00"
 */
export function convertHTMLStrDateToISO(strDate: string) {
    return new Date(strDate).toISOString().replace('T', ' ').split('.')[0]
}
