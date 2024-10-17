#!/usr/bin/env python3
from setuptools import setup

setup(name='pyjaiaprotobuf',
      version='1.0',
      description='Jaia python protobuf messages',
      author='Jaia Robotics',
      author_email='edsanville@gmail.com',
      url='https://www.jaia.tech',
      packages=[
          'dccl', 
          'goby.middleware.protobuf', 
          'jaiabot.messages'],
      install_requires=[
          'wheel', 
          'protobuf', 
          ]
    )
