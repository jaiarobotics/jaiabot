#!/usr/bin/env python3
from setuptools import setup

setup(name='pyjaia',
      version='1.0',
      description='Jaia python utilities',
      author='Jaia Robotics',
      author_email='edsanville@gmail.com',
      url='https://www.jaia.tech',
      packages=[
          'pyjaia',
          'pyjaia.waves'],
      install_requires=[
          'wheel', 
          'protobuf', 
          'scipy', 
          'numpy', 
          'cmocean',
          'turfpy'
          ],
        scripts=[
            'pyjaia/waves/jaia-analyze-waves.py'
        ]
    )
