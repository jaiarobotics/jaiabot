#!/bin/bash

here=`pwd`

header_strip()
{
    endtext='If not, see <http:\/\/www.gnu.org\/licenses\/>.'
    for i in `grep -lr "$endtext" | egrep "\.cpp$|\.h$"`
    do 
        echo $i
        l=$(grep -n "$endtext" $i | tail -1 | cut -d ":" -f 1)
        l=$(($l+1))
        echo $l
        tail -n +$l $i | sed '/./,$!d' > $i.tmp;
        mv $i.tmp $i
    done
}

gen_authors()
{
    i=$1
    echo $i;
    mapfile -t authors < <(git blame --line-porcelain $i | grep "^author " | sort | uniq -c | sort -nr | sed 's/^ *//' | cut -d " " -f 3-)
    #    echo ${authors[@]}
    start_year=$(git log --follow --date=format:%Y --format=format:%ad $i | tail -n 1)
    end_year=$(git log --follow -n 1 --date=format:%Y --format=format:%ad $i)
    #    echo ${start_year}-${end_year}    

    if [[ "${start_year}" == "${end_year}" ]]; then
        years="${start_year}"
    else
        years="${start_year}-${end_year}"
    fi
    
    cat <<EOF > /tmp/jaia_authors.tmp
// Copyright ${years}:
EOF
    
    if (( $end_year >= 2013  )); then
        echo "//   JaiaRobotics LLC" >>  /tmp/jaia_authors.tmp
    fi

    cat <<EOF >> /tmp/jaia_authors.tmp
// File authors:
EOF
    
    for author in "${authors[@]}"
    do
        # use latest email for author name here
        email=$(git log --use-mailmap --author "$author" -n 1 --format=format:%aE)
        if [ ! -z "$email" ]; then
            email=" <${email}>"
        fi
        echo "//   $author$email"  >> /tmp/jaia_authors.tmp
    done
}

pushd ../src/lib
header_strip
for i in `find -regex ".*\.h$\|.*\.cpp$\|.*\.proto$"`;
do
    gen_authors $i
    cat /tmp/jaia_authors.tmp $here/../src/doc/copyright/header_lib.txt $i > $i.tmp; mv $i.tmp $i;
done
popd

for dir in ../src/bin; do
    pushd $dir
    header_strip
    for i in `find -regex ".*\.h$\|.*\.cpp$\|.*\.proto$"`;
    do
        gen_authors $i
        cat /tmp/jaia_authors.tmp $here/../src/doc/copyright/header_bin.txt $i > $i.tmp; mv $i.tmp $i;
    done
    popd
done

rm /tmp/jaia_authors.tmp

