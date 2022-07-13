
export class LogApi {

  // Do a JSON GET request
  static get_json(url_string) {
    var request = new Request(url_string, {
      method : 'GET',
      headers : new Headers({'Content-Type' : 'application/json'})
    })

    return fetch(request)
        .catch(err => {console.error(err)})
        .then(resp => resp.json())
  }

  // Get a series corresponding to a set of log files and paths
  static get_series(logs, paths) {
    var url = new URL('series', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('path', paths.join(','))

    return this.get_json(url.toString()).catch(err => {console.error(err)});
  }

  // Gets all of the logs and associated metadata for each
  static get_logs() { return this.get_json('/logs') }

  static get_paths(logs, root_path) {
    var url = new URL('paths', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('root_path', root_path)

    return this.get_json(url.toString())
  }

  // Get map points
  static get_map(logs) {
    var url = new URL('map', window.location.origin)
    url.searchParams.append('log', logs.join(','))

    return this.get_json(url.toString())
  }
}
