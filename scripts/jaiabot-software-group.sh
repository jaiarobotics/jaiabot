#!/bin/bash

# Set the keyword based on user choice
keyword=$1

lowercase_keyword=${keyword,,}

# Uncomment the line with the selected keyword and comment out all other lines
sudo sed -i -e "/.*${lowercase_keyword}.*/ s/^#//" -e "/.*${lowercase_keyword}.*/! s/^\([^#]\)/#\1/" /etc/apt/sources.list.d/jaiabot.list
