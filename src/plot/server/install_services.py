#!/usr/bin/env python3

'''Installs the systemd services for the JaiaLog server, and the goby to h5 conversion watcher'''

import string
import os

template_files = [
    'jaiabot_log_converter.service.template',
    'jaiabot_plot.service.template'
]

for template_file in template_files:
    template = string.Template(open(template_file).read())

    # Substitution dictionary
    subst = {
        'working_directory': '/opt/jaiabotplot/server',
        'user': 'jaia'
    }

    output = template.substitute(subst)

    basename = template_file.replace('.template', '')
    output_file = f'/etc/systemd/system/{basename}'

    open(output_file, 'w').write(output)
