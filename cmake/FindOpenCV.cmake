# FindOpenCV.cmake - Find OpenCV libraries with proper deployment support

# Option to prefer system libraries over bundled ones
option(OPENCV_USE_SYSTEM_LIBS "Prefer system OpenCV libraries over bundled" ON)

# Find include directory
find_path(OpenCV_INCLUDE_DIR
    NAMES opencv2/core.hpp
    PATH_SUFFIXES opencv4
    HINTS 
        /usr/include
        /usr/local/include
)

# Find libraries - search system paths first if preferred
if(OPENCV_USE_SYSTEM_LIBS)
    set(CMAKE_FIND_LIBRARY_SUFFIXES_BACKUP ${CMAKE_FIND_LIBRARY_SUFFIXES})
    # Prefer shared libraries
    set(CMAKE_FIND_LIBRARY_SUFFIXES .so ${CMAKE_FIND_LIBRARY_SUFFIXES})
endif()

find_library(OpenCV_CORE_LIB 
    NAMES opencv_core
    HINTS /usr/lib /usr/local/lib /lib/aarch64-linux-gnu /lib/x86_64-linux-gnu
)
find_library(OpenCV_IMGPROC_LIB 
    NAMES opencv_imgproc
    HINTS /usr/lib /usr/local/lib /lib/aarch64-linux-gnu /lib/x86_64-linux-gnu
)
find_library(OpenCV_IMGCODECS_LIB 
    NAMES opencv_imgcodecs
    HINTS /usr/lib /usr/local/lib /lib/aarch64-linux-gnu /lib/x86_64-linux-gnu
)
find_library(OpenCV_DNN_LIB 
    NAMES opencv_dnn
    HINTS /usr/lib /usr/local/lib /lib/aarch64-linux-gnu /lib/x86_64-linux-gnu
)
find_library(OpenCV_VIDEOIO_LIB 
    NAMES opencv_videoio
    HINTS /usr/lib /usr/local/lib /lib/aarch64-linux-gnu /lib/x86_64-linux-gnu
)

if(OPENCV_USE_SYSTEM_LIBS)
    set(CMAKE_FIND_LIBRARY_SUFFIXES ${CMAKE_FIND_LIBRARY_SUFFIXES_BACKUP})
endif()

mark_as_advanced(OpenCV_INCLUDE_DIR OpenCV_CORE_LIB OpenCV_IMGPROC_LIB 
                 OpenCV_IMGCODECS_LIB OpenCV_DNN_LIB OpenCV_VIDEOIO_LIB)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(OpenCV DEFAULT_MSG
    OpenCV_CORE_LIB OpenCV_INCLUDE_DIR)

if(OpenCV_FOUND)
    # Collect all libraries for easy iteration
    set(OpenCV_LIBRARIES 
        ${OpenCV_CORE_LIB}
        ${OpenCV_IMGPROC_LIB}
        ${OpenCV_IMGCODECS_LIB}
        ${OpenCV_DNN_LIB}
        ${OpenCV_VIDEOIO_LIB}
    )

    # Set RPATH so installed and deployed binaries find libs relative to themselves.
    # $ORIGIN/../lib covers build_dir/lib/ (populated at configure time by the Find modules).
    set(CMAKE_INSTALL_RPATH "$ORIGIN/../lib:/lib/aarch64-linux-gnu:/usr/lib/aarch64-linux-gnu")
    set(CMAKE_INSTALL_RPATH_USE_LINK_PATH TRUE)
    # Use the install RPATH even for the build tree so deployed binaries work correctly.
    set(CMAKE_BUILD_WITH_INSTALL_RPATH TRUE)

    # Stage versioned OpenCV .so files into the build lib dir for rsync deployment.
    file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
    foreach(_opencv_lib ${OpenCV_LIBRARIES})
        if(EXISTS "${_opencv_lib}")
            get_filename_component(_opencv_lib_dir "${_opencv_lib}" DIRECTORY)
            get_filename_component(_opencv_lib_name "${_opencv_lib}" NAME)
            string(REGEX REPLACE "\\.so.*$" "" _opencv_lib_base "${_opencv_lib_name}")
            file(GLOB _opencv_versioned "${_opencv_lib_dir}/${_opencv_lib_base}.so.*")
            if(_opencv_versioned)
                file(COPY ${_opencv_versioned} DESTINATION "${CMAKE_BINARY_DIR}/lib")
            endif()
        endif()
    endforeach()
    unset(_opencv_lib)
    unset(_opencv_lib_dir)
    unset(_opencv_lib_name)
    unset(_opencv_lib_base)
    unset(_opencv_versioned)
    
    # Create the modern Imported Target
    if(NOT TARGET OpenCV::OpenCV)
        add_library(OpenCV::OpenCV INTERFACE IMPORTED)
        set_target_properties(OpenCV::OpenCV PROPERTIES
            INTERFACE_INCLUDE_DIRECTORIES "${OpenCV_INCLUDE_DIR}"
            INTERFACE_LINK_LIBRARIES "${OpenCV_LIBRARIES}"
        )
    endif()
    
    # Print what was found for debugging
    message(STATUS "OpenCV found:")
    message(STATUS "  Include dir: ${OpenCV_INCLUDE_DIR}")
    message(STATUS "  Core lib: ${OpenCV_CORE_LIB}")
    
    # Determine if we're using system libraries or bundled ones
    get_filename_component(OPENCV_LIB_DIR ${OpenCV_CORE_LIB} DIRECTORY)
    if(OPENCV_LIB_DIR MATCHES "^/usr/lib" OR OPENCV_LIB_DIR MATCHES "^/lib/")
        message(STATUS "  Using SYSTEM OpenCV libraries from: ${OPENCV_LIB_DIR}")
        set(OpenCV_IS_SYSTEM TRUE CACHE BOOL "Whether OpenCV is from system")
    else()
        message(STATUS "  Using BUNDLED OpenCV libraries from: ${OPENCV_LIB_DIR}")
        set(OpenCV_IS_SYSTEM FALSE CACHE BOOL "Whether OpenCV is from system")
        
        # If using bundled libraries, set up installation rules
        foreach(LIB ${OpenCV_LIBRARIES})
            if(EXISTS ${LIB})
                # Install the library file
                install(FILES ${LIB} DESTINATION lib)
                
                # Also install any symlinks or versioned libraries
                get_filename_component(LIB_DIR ${LIB} DIRECTORY)
                get_filename_component(LIB_NAME ${LIB} NAME)
                
                # Get library name without extension for pattern matching
                string(REGEX REPLACE "\\.so.*$" "" LIB_BASE ${LIB_NAME})
                
                # Install all related .so files (versioned symlinks)
                file(GLOB LIB_VARIANTS "${LIB_DIR}/${LIB_BASE}.so*")
                install(FILES ${LIB_VARIANTS} DESTINATION lib)
            endif()
        endforeach()
    endif()
    
endif()