import { Load, Save } from './Settings'
import { PodMissionLibrary, PodMission, Missions } from './Missions'

const savedMissions = Load<PodMissionLibrary>('savedMissions', Missions.defaultMissions())

export class MissionLibraryLocalStorage {
    static missionLibraryLocalStorage: MissionLibraryLocalStorage

    static shared() {
        if (MissionLibraryLocalStorage.missionLibraryLocalStorage == null) {
            MissionLibraryLocalStorage.missionLibraryLocalStorage = new MissionLibraryLocalStorage()
        }
        return MissionLibraryLocalStorage.missionLibraryLocalStorage
    }

    constructor() {
    }

    missionNames() {
        let savedMissionNames = Object.keys(savedMissions).filter((value) => {
            return value != '_localStorageKeyFunc'
        }). sort()
        return savedMissionNames
    }

    hasMission(name: string) {
        return (name in savedMissions)
    }

    loadMission(key: string) {
        console.log('loadMission: ', savedMissions[key])
        return savedMissions[key]
    }

    saveMission(key: string, mission: PodMission) {
        if (key == null) {
            return
        }

        savedMissions[key] = JSON.parse(JSON.stringify(mission))
        Save(savedMissions)
    }

    deleteMission(key: string) {
        if (key == null) {
            return
        }

        delete savedMissions[key]
        Save(savedMissions)
    }

}
