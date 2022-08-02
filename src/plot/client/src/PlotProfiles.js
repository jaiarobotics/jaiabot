export default class PlotProfiles {

    static plot_profiles() {
        var plot_profiles
        try {
          plot_profiles = JSON.parse(localStorage["plot_profiles"])
        }
        catch(error) {
          plot_profiles = {}
        }
      
        return plot_profiles
      }
      
    static load_profile(profile_name) {
        return this.plot_profiles()[profile_name]
    }

    static save_profile(profile_name, profile) {
        var plot_profiles = this.plot_profiles()
        plot_profiles[profile_name] = profile
        localStorage["plot_profiles"] = JSON.stringify(plot_profiles)
    }

}