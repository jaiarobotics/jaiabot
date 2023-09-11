import { LoadMissions, SaveMissions } from './Settings'
import { RunLibrary } from './Missions'
import { MissionInterface } from './CommandControl';

const savedMissionKey = "savedMissions"

const savedMissions = LoadMissions<RunLibrary>(savedMissionKey)

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
        let savedMissionNames = Object.keys(savedMissions). sort()
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
        SaveMissions(savedMissionKey, savedMissions)
    }

    deleteMission(key: string) {
        if (key == null) {
            return
        }

        delete savedMissions[key]
        SaveMissions(savedMissionKey, savedMissions)
    }

}
