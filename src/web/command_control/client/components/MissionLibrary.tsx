import { Settings } from './Settings'
import { PodMissionLibrary, PodMission, Missions } from './Missions'

export class MissionLibraryLocalStorage {
    savedMissions: PodMissionLibrary

    static missionLibraryLocalStorage: MissionLibraryLocalStorage

    static shared() {
        if (MissionLibraryLocalStorage.missionLibraryLocalStorage == null) {
            MissionLibraryLocalStorage.missionLibraryLocalStorage = new MissionLibraryLocalStorage()
        }
        return MissionLibraryLocalStorage.missionLibraryLocalStorage
    }

    constructor() {
        this.savedMissions = Settings.savedMissions.get() || Missions.defaultMissions()
    }

    missionNames() {
        return Object.keys(this.savedMissions).sort()
    }

    hasMission(name: string) {
        return (name in this.savedMissions)
    }

    loadMission(key: string) {
        console.log('loadMission: ', this.savedMissions[key])
        return this.savedMissions[key]
    }

    saveMission(key: string, mission: PodMission) {
        if (key == null) {
            return
        }

        this.savedMissions[key] = JSON.parse(JSON.stringify(mission))
        Settings.savedMissions.set(this.savedMissions)
    }

    deleteMission(key: string) {
        if (key == null) {
            return
        }

        delete this.savedMissions[key]
        Settings.savedMissions.set(this.savedMissions)
    }

}
