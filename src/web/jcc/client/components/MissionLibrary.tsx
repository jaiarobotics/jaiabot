import { LoadMissions, SaveMissions } from "./Settings";
import { RunLibrary } from "./Missions";
import { MissionInterface } from "./CommandControl";

const savedMissionsKey = "savedMissions";

let savedMissions = LoadMissions<RunLibrary>(savedMissionsKey);

export class MissionLibraryLocalStorage {
    static missionLibraryLocalStorage: MissionLibraryLocalStorage;

    static shared() {
        if (MissionLibraryLocalStorage.missionLibraryLocalStorage == null) {
            MissionLibraryLocalStorage.missionLibraryLocalStorage =
                new MissionLibraryLocalStorage();
        }
        return MissionLibraryLocalStorage.missionLibraryLocalStorage;
    }

    constructor() {}

    missionNames() {
        // Check to see if we have saved missions
        if (savedMissions) {
            let savedMissionNames = Object?.keys(savedMissions).sort();
            return savedMissionNames;
        }

        return [];
    }

    hasMission(name: string) {
        if (savedMissions) {
            return name in savedMissions;
        }

        return;
    }

    loadMission(key: string) {
        savedMissions = LoadMissions<RunLibrary>(savedMissionsKey);

        if (savedMissions) {
            return savedMissions[key];
        }

        return;
    }

    saveMission(key: string, mission: MissionInterface) {
        if (!key) {
            return;
        }

        if (!savedMissions) {
            savedMissions = {};
        }

        savedMissions[key] = JSON.parse(JSON.stringify(mission));
        SaveMissions(savedMissionsKey, savedMissions);
    }

    deleteMission(key: string) {
        if (key == null) {
            return;
        }

        delete savedMissions[key];
        SaveMissions(savedMissionsKey, savedMissions);
    }
}
