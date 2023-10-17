import {Log} from "./Log"
import download from "downloadjs"



/**
 * Initiates a browser download of the given URL, with filename and mimeType
 * @date 10/14/2023 - 8:29:07 PM
 *
 * @param {string} url URL of the target
 * @param {string} [filename='filename'] Default filename to save the URL as
 * @param {string} [mimeType='text/plain'] MIME type of the content
 * @returns {*} A Promise for the fetch operation
 */
function downloadURL(url: string, filename: string='filename', mimeType: string='text/plain') {
  return fetch(url, { method: 'GET' })
  .then( res => {
    return res.blob()
  })
  .then( blob => {
    download(blob, filename, mimeType)
  });
}


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

  // Get a series corresponding to a set of log files and paths
  static get_series(logs: string[], paths: string[]) {
    var url = new URL('series', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('path', paths.join(','))

    return this.get_json(url.toString());
  }

  // Gets all of the logs and associated metadata for each
  static get_logs(): Promise<Log[]> { return this.get_json('/logs') }

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

  static delete_log(logName: string) {
    const request = new Request(`/log/${logName}`, {method: 'DELETE'})
    fetch(request)
  }

  static get_moos(logs: string[], time_range: number[]) {
    var url = new URL('moos', window.location.origin)
    url.searchParams.append('log', logs.join(','))
    url.searchParams.append('t_start', String(time_range[0]))
    url.searchParams.append('t_end', String(time_range[1]))

    return downloadURL(url.toString(), 'moos.csv', 'text/csv')
  }

  static get_hdf5(log: string) {
    var url = new URL('h5', window.location.origin)
    url.searchParams.append('file', log)

    const components = log.split('/')
    const filename = components[components.length - 1]

    return downloadURL(url.toString(), filename, 'application/x-hdf')
  }

}
