find_path(BYTETRACK_INCLUDE_DIR
    NAMES ByteTrack/BYTETracker.h
    HINTS "/usr/local/include"
          "/usr/include"
)

find_library(BYTETRACK_LIB
    NAMES bytetrack ByteTrack
    HINTS "/usr/local/lib"
)

find_path(EIGEN3_INCLUDE_DIR
    NAMES Eigen/Dense
    HINTS "/usr/include/eigen3"
          "/usr/local/include/eigen3"
    NO_DEFAULT_PATH
)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(ByteTrack DEFAULT_MSG
    BYTETRACK_LIB BYTETRACK_INCLUDE_DIR EIGEN3_INCLUDE_DIR)

if(ByteTrack_FOUND)
    if(NOT TARGET ByteTrack::ByteTrack)
        add_library(ByteTrack::ByteTrack UNKNOWN IMPORTED)
        set_target_properties(ByteTrack::ByteTrack PROPERTIES
            INTERFACE_INCLUDE_DIRECTORIES "${BYTETRACK_INCLUDE_DIR};${EIGEN3_INCLUDE_DIR}"
            IMPORTED_LOCATION "${BYTETRACK_LIB}"
        )
    endif()

    # Stage libbytetrack into the build lib dir for rsync deployment.
    get_filename_component(_bt_lib_dir "${BYTETRACK_LIB}" DIRECTORY)
    file(GLOB _bt_staging_libs "${_bt_lib_dir}/libbytetrack*.so*")
    if(_bt_staging_libs)
        file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
        file(COPY ${_bt_staging_libs} DESTINATION "${CMAKE_BINARY_DIR}/lib")
    endif()
    unset(_bt_lib_dir)
    unset(_bt_staging_libs)
endif()
