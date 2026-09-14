import os

# This is a map between the value of the environment variable and the regex
#   to use to filter logging by group name
GOBY_LOGGER_GROUP_REGEX_DICT = {
    'RELEASE': r'(?!(.*_internal.*|.*moos.*|.*engineering.*|.*mcu_pb_data.*|.*bot2bot_data.*)).*',
    'ENGINEERING': r'(?!(.*_internal.*|.*moos.*|.*mcu_pb_data.*)).*',
    'DEBUG': r'(?!(.*_internal.*|.*mcu_pb_data.*)).*'
}


try:
    jaia_goby_log_level = os.environ['jaia_goby_log_level']
except:
    jaia_goby_log_level = 'RELEASE'


group_regex = GOBY_LOGGER_GROUP_REGEX_DICT[jaia_goby_log_level]
