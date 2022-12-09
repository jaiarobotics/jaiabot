import { Settings } from './Settings'
import { Missions } from './Missions'

var missionLibraryLocalStorage

export class MissionLibraryLocalStorage {

    static shared() {
        if (missionLibraryLocalStorage == null) {
            missionLibraryLocalStorage = new MissionLibraryLocalStorage()
        }
        return missionLibraryLocalStorage
    }

    constructor() {
        this.savedMissions = Settings.savedMissions.get() || Missions.defaultMissions()
    }

    missionNames() {
        return Object.keys(this.savedMissions).sort()
    }

    hasMission(name) {
        return (name in this.savedMissions)
    }

    loadMission(key) {
        return this.savedMissions[key]
    }

    saveMission(key, mission) {
        if (key == null) {
            return
        }

        this.savedMissions[key] = JSON.parse(JSON.stringify(mission))
        Settings.savedMissions.set(this.savedMissions)
    }

    deleteMission(key) {
        if (key == null) {
            return
        }

        delete this.savedMissions[key]
        Settings.savedMissions.set(this.savedMissions)
    }

}
