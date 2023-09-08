import { Load, Save } from './Settings'
import { Missions, RunLibrary } from './Missions'
import { MissionInterface } from './CommandControl';

const savedMissions = Load<RunLibrary>('savedMissions', Missions.defaultMissions())

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
        console.log(savedMissions)

        let savedMissionNames = Object.keys(savedMissions).filter((value) => {
            return value != '_localStorageKeyFunc'
        }). sort()
        return savedMissionNames
    }

    hasMission(name: string) {
        return (name in savedMissions)
    }

    loadMission(key: string) {
        return savedMissions[key]
    }

    saveMission(key: string, mission: MissionInterface) {
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
