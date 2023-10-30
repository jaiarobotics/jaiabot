# Get the parameters passed from the custom command
set(DCCL_NAME ${DCCL_NAME})
set(EXPECTED_HASH ${EXPECTED_HASH})
set(MESSAGES_LIB_PATH ${MESSAGES_LIB_PATH})

# Run the binary with DCCL_NAME and capture the output
execute_process(
  COMMAND dccl -l ${MESSAGES_LIB_PATH} --analyze -m ${DCCL_NAME} --hash_only
  OUTPUT_VARIABLE OUTPUT_HASH
  ERROR_VARIABLE ERROR
  RESULT_VARIABLE RESULT
  )

string(REGEX REPLACE "\n$" "" OUTPUT_HASH "${OUTPUT_HASH}")

# Check if the computed hash matches the expected hash
if (NOT OUTPUT_HASH STREQUAL EXPECTED_HASH)
  message(FATAL_ERROR "DCCL hash mismatch for message ${DCCL_NAME}! Expected: ${EXPECTED_HASH}, Got: ${OUTPUT_HASH}. Please update PROJECT_INTERVEHICLE_API_VERSION in jaiabot/CMakeLists.txt and expected hash in jaiabot/src/lib/messages/CMakeLists.txt ")
endif()
