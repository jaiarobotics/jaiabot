find_path(ONNXRUNTIME_INCLUDE_DIR 
    NAMES onnxruntime_cxx_api.h
    HINTS "/usr/local/include"
)

find_library(ONNXRUNTIME_LIB 
    NAMES onnxruntime
    HINTS "/usr/local/lib"
)

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(OnnxRuntime DEFAULT_MSG
    ONNXRUNTIME_LIB ONNXRUNTIME_INCLUDE_DIR)

if(OnnxRuntime_FOUND)
    add_library(OnnxRuntime::OnnxRuntime UNKNOWN IMPORTED)
    set_target_properties(OnnxRuntime::OnnxRuntime PROPERTIES
        INTERFACE_INCLUDE_DIRECTORIES "${ONNXRUNTIME_INCLUDE_DIR}"
        IMPORTED_LOCATION "${ONNXRUNTIME_LIB}"
    )

    # Stage all onnxruntime .so files into the build lib dir so they are
    # picked up by the rsync deployment (arm64-deploy flow).
    get_filename_component(_ort_lib_dir "${ONNXRUNTIME_LIB}" DIRECTORY)
    file(GLOB _ort_staging_libs "${_ort_lib_dir}/libonnxruntime*.so*")
    if(_ort_staging_libs)
        file(MAKE_DIRECTORY "${CMAKE_BINARY_DIR}/lib")
        file(COPY ${_ort_staging_libs} DESTINATION "${CMAKE_BINARY_DIR}/lib")
    endif()
    unset(_ort_lib_dir)
    unset(_ort_staging_libs)
endif()