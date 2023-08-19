export class LogApi {

  // Do a JSON GET request
  static get_json(url_string: string) {
    var request = new Request(url_string, {
      method : 'GET',
      headers : new Headers({'Content-Type' : 'application/json'})
    })

    return fetch(request)
        .then(resp => resp.json())
        .then(response_object => {
          // If there's an error message in there, we need to throw it
          if (response_object.error != null) {
            throw new Error(response_object.error)
          } else {
            return response_object
          }
        })
        .catch(err => {console.error(err)})
  }

  // Download a GET request
  static download_file(url: string) {
    return fetch(url, { method: 'GET' })
    .then( res => res.blob() )
    .then( blob => {
      var file = window.URL.createObjectURL(blob);
      window.location.assign(file);
    });
  }

  // Do a JSON GET request
  static post(url_string: string, jsonObject: object) {
    var request = new Request(url_string, {
      method : 'POST',
      headers : new Headers({'Content-Type' : 'application/json'}),
      body: JSON.stringify(jsonObject)
    })

    return fetch(request)
        .then(resp => resp.json())
        .then(response_object => {
          // If there's an error message in there, we need to throw it
          if (response_object.error != null) {
            throw new Error(response_object.error)
          } else {
            return response_object
          }
        })
        .catch(err => {console.error(err)})
  }

  // Get a series corresponding to a set of log files and paths
  static get_series(logs: string[], paths: string[]) {
    var url = new URL('series', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('path', paths.join(','))

    return this.get_json(url.toString());
  }

  // Gets all of the logs and associated metadata for each
  static get_logs() { return this.get_json('/logs') }

  static get_paths(logs: string[], root_path: string) {
    var url = new URL('paths', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('root_path', root_path)

    return this.get_json(url.toString())
  }

  // Get map points
  static get_map(logs: string[]) {
    var url = new URL('map', window.location.origin)
    url.searchParams.append('log', logs.join(','))

    return this.get_json(url.toString())
  }

  // Get commands
  static get_commands(logs: string[]) {
    var url = new URL('commands', window.location.origin)
    url.searchParams.append('log', logs.join(','))

    return this.get_json(url.toString())
  }

  // Get active_goals
  static get_active_goal(logs: string[]) {
    var url = new URL('active-goal', window.location.origin)
    url.searchParams.append('log', logs.join(','))

    return this.get_json(url.toString())
  }

  // Get task_packets
  static get_task_packets(logs: string[]) {
    var url = new URL('task-packet', window.location.origin)
    url.searchParams.append('log', logs.join(','))

    return this.get_json(url.toString())
  }

  // Get depth_contours
  static get_depth_contours(logs: string[]) {
    var url = new URL('depth-contours', window.location.origin)
    url.searchParams.append('log', logs.join(','))

    return this.get_json(url.toString())
  }

  static get_moos(logs: string[], time_range: number[]) {
    var url = new URL('moos', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('t_start', String(time_range[0]))
    url.searchParams.append('t_end', String(time_range[1]))

    return this.download_file(url.toString())
  }

  // Convert logs if needed
  static post_convert_if_needed(logs: string[]) {
    return this.post('convert-if-needed', logs)
  }

}
