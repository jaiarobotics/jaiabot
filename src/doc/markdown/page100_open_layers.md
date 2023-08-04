# Jaia | OpenLayers Guide

## Adding an element to the map

<br>

### Should I add an OpenLayers Feature or OpenLayers Overlay?

* If you are adding a popup or notificiation use either an Overlay or a traditional DOM element. Otherwise, use a Feature for components that depict the run or mission on the map.

<br>

### Implementing a Feature in the current Jaiabot repo
* Follow the model set by creating waypoints
1. In MissionFeatures.ts, assign a new variable to the output of the createMarker function located in Marker.ts
* In the funtion createMarker, add a new Feature in a similar fashion to the creation of markerFeature
3. Push this new feature to the features array
4. The feature will appear on the map when the updateMissionLayer function is called

<br>

### Implementing a Feature from scratch

1. Import Feature from "ol" and Point from "ol/geom"
```
import { Feature } from "ol"
import { Point } from "ol/geom"
```
2. Instantiate a new feature
```
const coordinate = fromLonLat(lonLat, map.getView().getProjection())

const newFeature = new Feature({
    name: 'New Feature',
    geometry: new Point(coordinate)
})
```
3. Set the style on the new feature by calling the method setStyle and passing an OpenLayers Style object
```
import { Fill, Icon, Style, Text} from 'ol/style';

const src = require('./icon.svg') as string

const icon = new Icon({
    src: src,
    color: '#FFFFFF',
    anchor: [0.5, 1]
})

const style = new Style({
    image: icon,
    text: new Text({
        text: 'Img Txt',
        font: '12pt sans-serif',
        fill: new Fill({
            color: '#000000'
        }),
        offsetY: -15,
        offsetX: 30
    }),
    zIndex: 2
})

newFeature.setStyle(style)
````
4. Push the new feature to an array
```
const features  = []
features.push(newFeature)
```

5. Create a vector source with the features property set to the array of features you would like to add
```
import { OlVectorSource } from 'ol/source';

let vectorSource = new OlVectorSource({
    features: features as any
})
```
6. Create a layer and set the source
```
import { Vector as OlVectorLayer } from 'ol/layer';

const newLayer = new OlVectorLayer();
const newLayer.setSource(vectorSource)
```

7. The layer needs to be registered with the layers property in the map object
```
map = new OlMap({
    .
    .
    .
    layers: newLayer,
    .
    .
    ,
});
```

8. **To adjust the positoning of this feature on the map change the values of the icon's anchor property. This will keep the icon correctly positioned independent of the map's zoom**
```
const icon = new Icon({
    src: src,
    color: '#FFFFFF',
    anchor: [0.5, 1]
})
```

<br>

### Implementing an Overlay from scratch
```
import { Overlay } from 'ol'

interface State {
	popup: Overlay | null,
}

constructor(props: Props) {
    super(props)

    this.state = {
        popup: null,
    };
}

componentDidMount() {
    const popupDomNode = document.getElementById('popup')
    const popupOverlay = new Overlay({
        element: popupDomNode
    })
    // map is an OpenLayers Map object instantiated in the constructor
    map.addOverlay(popupOverlay)
    this.setState({popup: popupOverlay})
}

closePopup() {
    const popup = this.state.popup
    popup.setPosition(undefined)
    this.setState({popup: popup})
}

handleTriggerItemClick(evt: any) {
    const coordiantes = ol.proj.toLonLat(evt.coordinate);
    const popup = this.state.popup
    popup.setPosition(coordinates)
    this.setState({ popup: popup })
}

render() {
    return (

        <div>        .
            <div id="popup" onClick={this.closePopup.bind(this)}>
                <div id="popup-content className="ol-popup-content">Content</div>
                <div id="popup-closer" className="ol-popup-closer">
                    <Icon path={mdiCloseCircleOutline} className="ol-popup-closer-icon"/>
                </div>
            </div>
        .
        .
        .
        </div>

    )
}
```
* **Style the popup using traditional CSS**