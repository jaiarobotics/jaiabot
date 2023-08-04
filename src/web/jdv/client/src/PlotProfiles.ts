export type Profile = string[]
export type ProfileLibrary = { [key: string]: Profile }

export class PlotProfiles {

    static plot_profiles(): ProfileLibrary {
        var plot_profiles
        try {
          plot_profiles = JSON.parse(localStorage["plot_profiles"])
        }
        catch(error) {
          plot_profiles = {}
        }
      
        return plot_profiles
      }
      
    static load_profile(profile_name: string): Profile {
        return this.plot_profiles()[profile_name]
    }

    static save_profile(profile_name: string, profile: Profile) {
        console.log('Saving ' + profile_name)
        var plot_profiles = this.plot_profiles()
        plot_profiles[profile_name] = profile
        localStorage["plot_profiles"] = JSON.stringify(plot_profiles)
    }

    static exists(profile_name: string): boolean {
      return Object.keys(this.plot_profiles()).includes(profile_name)
    }

    static delete_profile(profile_name: string) {
      var profiles = this.plot_profiles()
      delete profiles[profile_name]
      localStorage["plot_profiles"] = JSON.stringify(profiles)
    }

}
