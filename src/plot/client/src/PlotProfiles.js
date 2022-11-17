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
        console.log('Saving ' + profile_name)
        var plot_profiles = this.plot_profiles()
        plot_profiles[profile_name] = profile
        localStorage["plot_profiles"] = JSON.stringify(plot_profiles)
    }

    static exists(profile_name) {
      return Object.keys(this.plot_profiles()).includes(profile_name)
    }

    static delete_profile(profile_name) {
      var profiles = this.plot_profiles()
      delete profiles[profile_name]
      localStorage["plot_profiles"] = JSON.stringify(profiles)
    }

}
