#!/bin/bash

# Given "offline" or "online" as the first parameter
# this script modifies the /etc/apt/sources.list files
# and pip.conf to set the jaiabot/hub to pull from online
# (packages.jaia.tech and ubuntu servers)
# or offline (e.g. CD / USB attached to hub0) sources

mode="$1"

function uncomment_sources() {
   file="$1"
   sudo sed -i 's/#*\(.*\)$/\1/' $file
}

function comment_sources() {
    file="$1"              
    sudo sed -i 's/\(^[^#].*\)$/#\1/' $file
}

case $mode in     
     online)
        # Uncomment online repos
        for list in /etc/apt/sources.list /etc/apt/sources.list.d/gobysoft.list /etc/apt/sources.list.d/jaiabot.list; do
            uncomment_sources $list
        done
        
        # Comment out offline repos
        comment_sources /etc/apt/sources.list.d/local.list
        comment_sources /etc/pip.conf
     ;;
    
     offline)
        # Comment out online resources
        for list in /etc/apt/sources.list /etc/apt/sources.list.d/gobysoft.list /etc/apt/sources.list.d/jaiabot.list; do
            comment_sources $list
        done

        # Uncomment offline repos
        uncomment_sources /etc/apt/sources.list.d/local.list
        uncomment_sources /etc/pip.conf
     ;;
     
     *)
     exit 1
     ;;
esac
