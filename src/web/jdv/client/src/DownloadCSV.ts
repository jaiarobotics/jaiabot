import {Plot} from './Plot'

export function downloadCSV(plots: Plot[], tRange: number[]) {
    var csvText = ''
    const plotNames = plots.map((plot) => { return plot.title })

    // Header row
    csvText = 'Time,_utime_,' + plotNames.join(',') + '\n'

    var t = tRange[0]
    const STEP = 1e6 // microseconds

    // Indices into the series
    var indices = Array(plots.length).fill(0)
    console.log(indices)

    while (t < tRange[1]) {
      t += STEP
      const timeString = (new Date(t / 1e3)).toISOString()
      var csvLine = `${timeString},${t}`

      var done = true // Finish when none of the series are incrementing their indices
      var nonempty = false

      for (const [plotIndex, plot] of plots.entries()) {
        var index = indices[plotIndex]

        if (index != plot._utime_.length - 1) {
          done = false
        }

        while (index < plot._utime_.length - 1 && plot._utime_[index + 1] < t) {
          index ++
        }

        var value = plot._utime_[index] < t ? plot.series_y[index] : null
        if (value != null) nonempty = true;

        csvLine += `,${value}`

        indices[plotIndex] = index
      }

      if (nonempty) {
        csvText += (csvLine + '\n')
      }

      if (done) break;
    }

    const blob = new Blob([csvText], {type: "text/csv"})

    var link = window.document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    // Construct filename dynamically and set to link.download
    link.download = 'missionData.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
