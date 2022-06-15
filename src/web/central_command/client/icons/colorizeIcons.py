#!/usr/bin/env python3

variableColor = '#00ffff'

colors = {
    'unselected': '#5ec957',
    'selected': '#34d2eb',
    'remoteControl': '#ff9800'
}

jobs = [
    ['start', 'unselected'],
    ['start', 'selected'],
    ['waypoint', 'unselected'],
    ['waypoint', 'selected'],
    ['stop', 'unselected'],
    ['stop', 'selected'],
    ['bot', 'selected'],
    ['bot', 'unselected'],
    ['bot', 'remoteControl']
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
    jsFile.write(f'export const {jsName}Style = new OlStyle({{ image: new OlIcon({{ src: {jsName} }}) }})\n')
    jsFile.write('\n')
