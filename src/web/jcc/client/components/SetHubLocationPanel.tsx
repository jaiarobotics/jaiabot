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
import { Select, MenuItem } from '@mui/material';

interface Props {
    hubs: {[key: number]: PortalHubStatus}
    api: JaiaAPI
    map: Map
}

export default class SetHubLocationPanel extends React.Component {
    props: Props
    _selectOnMapInteraction: Interaction
    hub_id: number

    constructor(props: Props) {
        super(props)
        this.hub_id = Object.values(this.props.hubs)[0].hub_id ?? null
    }

    render() {
        const hubLocation = this.props.hubs[0].location
        const selectingOnMap = (this._selectOnMapInteraction != null)

        const hubIdOptionElements = () => {
            return Object.values(this.props.hubs).map((hub) => {
                return <MenuItem value={hub.hub_id}>{`Hub ${hub.hub_id}`}</MenuItem>
            })
        }

        return (
            <div className="panel">
                <div className='panel-heading' style={{color: "black"}}>Set Hub Location</div>
                <div className='mission-settings-panel-container'>

                    <div className='mission-settings-input-label'>
                        Hub ID
                    </div>
                    <div className='mission-settings-input-row'>
                        <Select id="bot-id-select" defaultValue={this.hub_id} onChange={(evt) => {
                                this.hub_id = Number(evt.target.value)
                            }}>
                            { hubIdOptionElements() }
                        </Select>
                    </div>

                    <div className='mission-settings-input-label'>Latitude</div>
                    <div className='mission-settings-input-row'>
                        <input className="mission-settings-num-input"
                            id="set-hub-location-latitude" 
                            name="latitude" 
                            defaultValue={hubLocation.lat.toFixed(6)}
                        />
                    </div>

                    <div className='mission-settings-input-label'>Longitude</div>
                    <div className='mission-settings-input-row'>
                        <input className="mission-settings-num-input"
                            id="set-hub-location-longitude" 
                            name="longitude" 
                            defaultValue={hubLocation.lon.toFixed(6)}
                        />
                    </div>

                    <Button
                        className="button-jcc engineering-panel-btn" 
                        type="button" 
                        id="set-hub-location-submit"
                        onClick={() => {
                            this.submitHubLocation(this.hub_id, this.getHubLocation())
                        }}>
                        Submit Values
                    </Button>
                    <Button 
                        className={"button-jcc engineering-panel-btn" + (selectingOnMap ? " selected" : "")}
                        type="button" 
                        id="set-hub-location-map-select"
                        onClick={this.selectOnMap.bind(this)}
                        >
                        Select on Map
                    </Button>
                </div>
            </div>
        )
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
                    this.submitHubLocation(this.hub_id, hubLocation)

                    this.destroySelectOnMapInteraction()
                    return false
                }
            },
            stopDown: () => { return true }
        })

        this.props.map.addInteraction(this._selectOnMapInteraction)
        this.props.map.getTargetElement().style.cursor = 'crosshair'
    }

    
    /**
     * Destroy the hub location selection interaction.
     */
    destroySelectOnMapInteraction() {
        this.props.map.removeInteraction(this._selectOnMapInteraction)
        this._selectOnMapInteraction = null
        this.props.map.getTargetElement().style.cursor = 'default'
    }

    
    componentWillUnmount(): void {
        this.destroySelectOnMapInteraction()
    }

}
