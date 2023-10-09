# Get the parameters passed from the custom command
set(DCCL_NAME ${DCCL_NAME})
set(EXPECTED_MD5 ${EXPECTED_MD5})
set(MESSAGES_LIB_PATH ${MESSAGES_LIB_PATH})

# Run the binary with DCCL_NAME and capture the output
execute_process(
  COMMAND dccl -l ${MESSAGES_LIB_PATH} --analyze -m ${DCCL_NAME}
  OUTPUT_VARIABLE OUTPUT
  ERROR_VARIABLE ERROR
  RESULT_VARIABLE RESULT
  )

if (NOT RESULT STREQUAL "0")
  message(FATAL_ERROR "Failed to run 'dccl' tool to check DCCL MD5 hash mismatch for message ${DCCL_NAME}. Error: ${ERROR}")
endif()

# Compute the MD5 hash of the output
string(MD5 OUTPUT_MD5 "${OUTPUT}")

# Check if the computed MD5 hash matches the expected hash
if (NOT OUTPUT_MD5 STREQUAL EXPECTED_MD5)
  message(FATAL_ERROR "DCCL MD5 hash mismatch for message ${DCCL_NAME}! Expected: ${EXPECTED_MD5}, Got: ${OUTPUT_MD5}. Please update PROJECT_INTERVEHICLE_API_VERSION in jaiabot/CMakeLists.txt and expected MD5 hash in jaiabot/src/lib/messages/CMakeLists.txt ")
endif()
