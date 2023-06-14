#!/bin/bash

# Set the keyword based on user choice
keyword=$1

# Uncomment the line with the selected keyword and comment out all other lines
sed -i -e "/.*${keyword}.*/ s/^#//" -e "/.*${keyword}.*/! s/^\([^#]\)/#\1/" /etc/apt/sources.list.d/jaiabot.list
