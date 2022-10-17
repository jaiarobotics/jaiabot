#!/usr/bin/env python3

variableColor = '#00ffff'

colors = {
    'unselected': 'white',
    'selected': '#34d2eb',
    'remoteControl': '#ff9800',
    'active': '#5ec957',
    'disconnected': 'gray'
}

jobs = [
    ['start', 'unselected'],
    ['start', 'selected'],
    ['start', 'active'],
    ['waypoint', 'unselected'],
    ['waypoint', 'selected'],
    ['waypoint', 'active'],
    ['stop', 'unselected'],
    ['stop', 'selected'],
    ['stop', 'active'],
    ['dive', 'selected'],
    ['dive', 'unselected'],
    ['dive', 'active'],
    ['drift', 'selected'],
    ['drift', 'unselected'],
    ['drift', 'active'],
    ['stationkeep', 'selected'],
    ['stationkeep', 'unselected'],
    ['stationkeep', 'active'],

    ['bot', 'selected'],
    ['bot', 'unselected'],
    ['bot', 'remoteControl'],
    ['bot', 'disconnected'],
]

jsFile = open('Icons.jsx', 'w')
jsFile.write("import { Icon as OlIcon, Style as OlStyle } from 'ol/style'\n")

for job in jobs:
    baseName, colorName = job
    color = colors[colorName]

    inputFileName = f'{baseName}.svg'
    outputFileName = f'{baseName}-{colorName}.svg'

    open(outputFileName, 'w').write(open(inputFileName).read().replace(variableColor, color))

    # Build the JS file
    jsName = f"{baseName}{colorName[0].upper() + colorName[1:]}"

    jsFile.write(f'import {jsName} from "../icons/{outputFileName}"\n')
    jsFile.write(f'export {{{jsName}}}\n')
    jsFile.write(f'export const {jsName}Style = new OlStyle({{ image: new OlIcon({{ src: {jsName} }}) }})\n')
    jsFile.write('\n')

jsFile.write('\n')
