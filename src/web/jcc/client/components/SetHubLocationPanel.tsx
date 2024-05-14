/* eslint-disable jsx-a11y/label-has-for */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable react/sort-comp */
/* eslint-disable no-unused-vars */
import React from 'react'
import Button from '@mui/material/Button';
import {JaiaAPI} from '../../common/JaiaAPI'
import { PortalHubStatus } from './shared/PortalStatus';
import { CommandForHub, GeographicCoordinate, HubCommandType } from './shared/JAIAProtobuf';
import { getElementById, getGeographicCoordinate } from './shared/Utilities';
import { Map } from 'ol';
import { Interaction } from 'ol/interaction';
import PointerInteraction from 'ol/interaction/Pointer';

interface Props {
    hubs: {[key: number]: PortalHubStatus}
    api: JaiaAPI
    map: Map
}

export default class SetHubLocationPanel extends React.Component {
    props: Props
    _selectOnMapInteraction: Interaction

    constructor(props: Props) {
        super(props)
    }

    render() {
        const hubLocation = this.props.hubs[0].location
        const selectingOnMap = (this._selectOnMapInteraction != null)
        const defaultHubId = Object.values(this.props.hubs)[0].hub_id ?? null

        const hubIdOptionElements = () => {
            return Object.values(this.props.hubs).map((hub) => {
                return <option value={hub.hub_id}>{`Hub ${hub.hub_id}`}</option>
            })
        }

        return (
            <div className="panel">
                <label>Set Hub Location</label>
                <select id="bot-id-select" defaultValue={defaultHubId}>
                    { hubIdOptionElements() }
                </select>
                <Button 
                    className={"button-jcc engineering-panel-btn" + (selectingOnMap ? " selected" : "")}
                    type="button" 
                    id="set-hub-location-map-select"
                    onClick={this.selectOnMap.bind(this)}
                    >Select on Map</Button>
                <table>
                    <tbody>
                        <tr key="latitude">
                            <td>Latitude</td>
                            <td>
                                <input 
                                    id="set-hub-location-latitude" 
                                    name="latitude" 
                                    defaultValue={hubLocation.lat.toFixed(6)}
                                />
                            </td>
                        </tr>
                        <tr key="longitude">
                            <td>Longitude</td>
                            <td>
                                <input
                                    id="set-hub-location-longitude" 
                                    name="longitude" 
                                    defaultValue={hubLocation.lon.toFixed(6)}
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
                <Button
                    className="button-jcc engineering-panel-btn" 
                    type="button" 
                    id="set-hub-location-submit"
                    onClick={() => {
                        this.submitHubLocation(this.getSelectedHubId(), this.getHubLocation())
                    }}>
                    Submit Values
                </Button>
            </div>
        )
    }

    
    /**
     * Gets the currently selected hub_id from the GUI.
     *
     * @returns {*}
     */
    getSelectedHubId() {
        const selectElement = getElementById<HTMLSelectElement>('bot-id-select')
        return Number(selectElement.options[selectElement.selectedIndex].value)
    }

    
    /**
     * Gets the user-entered location from the longitude and latitude GUI fields.
     *
     * @returns {(GeographicCoordinate | null)}
     */
    getHubLocation(): GeographicCoordinate | null {
        const lat = Number(getElementById<HTMLInputElement>('set-hub-location-latitude').value)
        const lon = Number(getElementById<HTMLInputElement>('set-hub-location-longitude').value)
        if (lat == null || lon == null) {
            return null
        }

        return {
            lat: lat,
            lon: lon
        }
    }

    
    /**
     * Calls the API to submit a location change for a certain hub.
     *
     * @param {number} hub_id id of the hub to change location.
     * @param {GeographicCoordinate} hubLocation new location for the hub.
     */
    submitHubLocation(hub_id: number, hubLocation: GeographicCoordinate) {
        if (hubLocation == null) {
            console.warn('hub location is null')
            return
        }

        const hubCommand: CommandForHub = {
            hub_id: hub_id,
            type: HubCommandType.SET_HUB_LOCATION,
            set_hub_location: hubLocation
        }

        this.props.api.postCommandForHub(hubCommand)
    }

    
    /**
     * Initiate a PointerInteraction to select a new hub location with a click or tap.
     */
    selectOnMap() {
        this._selectOnMapInteraction = new PointerInteraction({
            handleEvent: (evt) => {
                if (evt.type == "click") {
                    const hubLocation = getGeographicCoordinate(evt.coordinate, evt.map)
                    this.submitHubLocation(this.getSelectedHubId(), hubLocation)

                    this.destroySelectOnMapInteraction()
                    return false
                }
            },
            stopDown: () => { return true }
        })

        this.props.map.addInteraction(this._selectOnMapInteraction)
    }

    
    /**
     * Destroy the hub location selection interaction.
     */
    destroySelectOnMapInteraction() {
        this.props.map.removeInteraction(this._selectOnMapInteraction)
        this._selectOnMapInteraction = null
    }

    
    componentWillUnmount(): void {
        this.destroySelectOnMapInteraction()
    }

}
