#!/bin/bash

set -e -u

# calculate the terminal size for whiptail (WT)
function calc_wt_size() {
  WT_HEIGHT=$(tput lines)
  WT_WIDTH=$(tput cols)
  WT_MENU_HEIGHT=$((${WT_HEIGHT} - 8))
}

# convert array of values into an array suitable for whiptail menu
function array_to_wt_menu() {
  local input=("$@")
  WT_ARRAY=()
  for i in "${!input[@]}"
  do
     WT_ARRAY+=("${input[$i]}")
     WT_ARRAY+=("")
  done
}

function array_to_wt_checklist() {
  local input=("$@")
  WT_ARRAY=()
  for i in "${!input[@]}"
  do
     WT_ARRAY+=("${input[$i]}")
     WT_ARRAY+=("")
     WT_ARRAY+=("0")
  done
}

# draw a GUI menu of options for the user using whiptail
# return choice in ${WT_CHOICE}
function run_wt_menu() {
    local title=$2
    local menu=$3
    shift 3
    local input=("$@")
    calc_wt_size
    array_to_wt_menu "${input[@]}"
    
    # insert stdout from the subshell directly in the controlling /dev/tty
    # so that we don't try to log any of the whiptail output
    WT_CHOICE=$(whiptail --title "$title" --menu "$menu" $WT_HEIGHT $WT_WIDTH $WT_MENU_HEIGHT "${WT_ARRAY[@]}" --output-fd 5 5>&1 1>/dev/tty)
}

# draw a GUI menu of options for the user using whiptail
# return choice in ${WT_CHOICE}
function run_wt_checklist() {
   local title=$1
   local menu=$2
   shift 2
   local input=("$@")
   calc_wt_size
   array_to_wt_checklist "${input[@]}"
   
   # insert stdout from the subshell directly in the controlling /dev/tty
   # so that we don't try to log any of the whiptail output
   WT_CHOICE=$(whiptail --title "$title" --checklist "$menu" $WT_HEIGHT $WT_WIDTH $WT_MENU_HEIGHT "${WT_ARRAY[@]}" --output-fd 5 5>&1 1>/dev/tty)
}

all_repos_except_release=("test" "continuous" "beta")
all_repos=("${all_repos_except_release[@]}" "release")
all_releases=("1.y" "2.y" ) # ... "3.y" "4.y" "5.y")

declare -A distros_for_releases

distros_for_releases["1.y"]="focal,noble"
distros_for_releases["2.y"]="noble"


function set_all_release()
{       
    for repo in "${all_repos[@]}"; do
        local b=$branch

        echo "Setting $repo to release"
        mkdir -p /var/www/html/ubuntu/gobysoft/${repo}
        rm -f /var/www/html/ubuntu/gobysoft/${repo}/${b}
        ln -s /var/spool/apt-mirror/release/${branch}/mirror/packages.gobysoft.org/ubuntu/release /var/www/html/ubuntu/gobysoft/${repo}/${b}
    done

}

function set_staging()
{
    # strip quotes
    repo=$(eval echo $1)
    local b=$branch

    echo "Setting $repo to staging"
    mkdir -p /var/www/html/ubuntu/gobysoft/${repo}
    rm -f /var/www/html/ubuntu/gobysoft/${repo}/${b}
    ln -s /var/spool/apt-mirror/staging/${branch}/mirror/packages.gobysoft.org/ubuntu/release /var/www/html/ubuntu/gobysoft/${repo}/${b}
}

function update_staging()
{
    rm -rf /var/spool/apt-mirror/staging/${branch}

    cat <<EOF > /tmp/gobysoft-apt-mirror-${branch}.list
############# config ##################
#
set base_path    /var/spool/apt-mirror/staging/${branch}
#
# set mirror_path  $$base_path/mirror
# set skel_path    $$base_path/skel
# set var_path     $$base_path/var
# set cleanscript $$var_path/clean.sh
# set defaultarch  <running host architecture>
# set postmirror_script $$var_path/postmirror.sh
set run_postmirror 0
set nthreads     20
set _tilde 0
#
############# end config ##############
EOF
    
    for distro in ${distros_for_releases[$branch]//,/ }
    do
        cat <<EOF >> /tmp/gobysoft-apt-mirror-${branch}.list
deb http://packages.gobysoft.org/ubuntu/release/ ${distro}/
deb-src http://packages.gobysoft.org/ubuntu/release/ ${distro}/
EOF
    done

   apt-mirror /tmp/gobysoft-apt-mirror-${branch}.list || exit 1    
}

function update_release()
{
    rm -rf /var/spool/apt-mirror/release/${branch}
    echo "Overwriting release with current staging"
    rsync -aP /var/spool/apt-mirror/staging/${branch} /var/spool/apt-mirror/release/
    set_all_release
}

function choose_repos()
{
    run_wt_checklist "Staging Repos" "Which repos to symlink to staging (the rest will be set to release)?" "${all_repos_except_release[@]}"
    staging_repos="${WT_CHOICE}"
    set_all_release
    for repo in $staging_repos
    do
        set_staging $repo
    done    
}


if [ ! "$UID" -eq 0 ]; then 
    echo "This script must be run as root" >&2
    exit 1;
fi

run_wt_menu action "Action" "Choose a Jaiabot release branch" "${all_releases[@]}"
branch=${WT_CHOICE}

if [ -z "$branch" ]; then
   exit
fi

echo "Branch: $branch"

update_staging="Update Staging Mirror"
update_release="Update Release Mirror from Staging"
choose_repos="Choose Staging and Release Repositories"

run_wt_menu action "Action" "Choose an action for the GobySoft mirror" "$update_staging" "$update_release" "$choose_repos"
action=${WT_CHOICE}

case "$action" in
    "$update_staging")
        update_staging
        choose_repos
        ;;
    "$update_release")
        update_release
        ;;
    "$choose_repos")
        choose_repos
        ;;
    *)
        echo "Quitting"
        exit 1
        ;;
esac

echo "Operation successful"
