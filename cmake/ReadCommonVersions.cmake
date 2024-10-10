# Turn the common-versions.env variables into upper case cmake variables.
# E.g., "jaia_version_release_branch=1.y" into JAIA_VERSION_RELEASE_BRANCH=1.y

set(CONFIG_FILE "${CMAKE_SOURCE_DIR}/scripts/common-versions.env")
file(READ "${CONFIG_FILE}" FILE_CONTENTS)
string(REPLACE "\n" ";" LINES "${FILE_CONTENTS}")

message(STATUS "Using Common Versions:")
foreach(LINE IN LISTS LINES)
    if(LINE MATCHES "([^=]+)=([^=]+)")
        string(REGEX REPLACE "([^=]+)=([^=]+)" "\\1" KEY "${LINE}")
        string(REGEX REPLACE "([^=]+)=([^=]+)" "\\2" VALUE "${LINE}")
        string(TOUPPER "${KEY}" UPPER_KEY)
        set(${UPPER_KEY} "${VALUE}")
        message(STATUS "   ${UPPER_KEY} = ${VALUE}")
    endif()
endforeach()
