#!/usr/bin/env python3
from setuptools import setup, find_packages

setup(name='jaia_serial',
    version='1.0',
    description='Jaia messages over serial connection',
    author='Jaia Robotics',
    author_email='edsanville@gmail.com',
    url='https://www.jaia.tech',
    package_dir={'': 'src'},  # Tells setuptools where to find packages
    packages=find_packages(where='src'), # Discovers packages within src
    install_requires=[
        'protobuf==3.20.0', 
        ]
)
