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
          'pyjaia.waves',
          'dccl', 
          'goby.middleware.protobuf', 
          'jaiabot.messages'],
      install_requires=[
          'wheel', 
          'protobuf==3.20.0', 
          'scipy', 
          'numpy', 
          'cmocean',
          'turfpy'
          ],
        scripts=[
            'pyjaia/waves/jaia-analyze-waves.py'
        ]
    )
