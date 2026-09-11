#!/usr/bin/env python3
from string import Template
import sys
import os

def template_substitute(fil, **kwargs):
    with open(fil, 'r') as file:
        return Template(file.read()).substitute(kwargs)
    
def checkdir(dir):
    if os.path.isdir(dir) == False:
        sys.exit('Invalid directory: {}'.format(dir))
def checkfile(fil):
    if os.path.isfile(fil) == False:
        sys.exit('Invalid file: {}'.format(fil))

def read_pb_cfg_block(path, block_name):
    try:
        return block_name + ' { \n' + open(path).read() + '\n}\n'
    except FileNotFoundError:
        return block_name + ' {}'

def fail(message):
    print('=============== INVALID CONFIGURATION =================')
    sys.stderr.write('========= Configuration Generated FAILED ==============\n\n')
    sys.stderr.write(message+'\n\n')
    sys.stderr.write('=======================================================\n')
    sys.exit(1)
    
