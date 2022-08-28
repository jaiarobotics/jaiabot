import { jaiaAPI } from "../../common/JaiaAPI"

const POLL_INTERVAL = 5000

export class DiveData {

    constructor() {
        this.pollTimer = setInterval(this.pollDivePackets.bind(this), POLL_INTERVAL)
    }

    pollDivePackets() {
        jaiaAPI.getDivePackets().then((divePackets) => {
            console.log('Dive packets: ', divePackets)
            this.divePackets = divePackets
        })
    }

}

export const diveData = new DiveData()
