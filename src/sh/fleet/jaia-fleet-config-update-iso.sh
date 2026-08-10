#!/bin/bash

set -e -u

# '--binary=jaia admin fleet update_iso'
binary="$1"

if [[ "$#" < "3" || "$2" = "--help" || "$2" = "-h"  ]]; then
   echo "Usage: ${1#*=} fleet.cfg updates.iso [output_updates.iso]"
   exit 1;
 fi

fleet_cfg="$2"
if [ ! -e ${fleet_cfg} ]; then
    echo "Fleet config ${fleet_cfg} does not exist"
    exit 1;
fi

fleet_id=$(grep "fleet:" ${fleet_cfg} | awk '{ print $2}')

if ! [ "$fleet_id" -gt 0 ] >& /dev/null;
then
    echo "Could not read valid fleet_id from ${fleet_cfg}"
    exit 1;
fi

input_iso="$3"
if [ ! -e ${input_iso} ]; then
    echo "Input ISO ${input_iso} does not exist"
    exit 1;
fi


default_output_iso=$(echo $input_iso | sed "s/\(.*\)\.iso/\1_fleet${fleet_id}.iso/")
output_iso=$(realpath ${4:-${default_output_iso}})

workdir="$(mktemp -d)"
iso_mountdir=${workdir}/iso

function finish {
  ( # Run in a subshell to ignore errors
      set +e
      sudo umount ${iso_mountdir}
      cd / && sudo rm -rf "$workdir" || true
  )
}
trap finish EXIT

mkdir ${iso_mountdir}
sudo mount -o loop,ro ${input_iso} ${iso_mountdir}
iso_contents_dir=${workdir}/newiso
mkdir ${iso_contents_dir}
rsync -a ${iso_mountdir}/ ${iso_contents_dir}/
sudo cp ${fleet_cfg} ${iso_contents_dir}/major_upgrade/fleet${fleet_id}.cfg

cd ${iso_contents_dir}
genisoimage -quiet -V updates -r -m rr_moved -o ${output_iso} .
echo "New ISO successfully written to ${output_iso}"
