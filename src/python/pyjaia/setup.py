#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(name='pyjaia',
    version='1.0',
    description='Jaia python utilities',
    author='Jaia Robotics',
    author_email='edsanville@gmail.com',
    url='https://www.jaia.tech',
    package_dir={'': 'src'},  # Tells setuptools where to find packages
    packages=find_packages(where='src'), # Discovers packages within src
    install_requires=[
        'wheel', 
        'protobuf==3.20.0', 
        'scipy', 
        'numpy', 
        'cmocean',
        'turfpy'
        ],
    scripts=[
        'src/pyjaia/waves/jaia-analyze-waves.py'
    ]
)
