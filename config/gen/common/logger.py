import os

# This is a map between the value of the environment variable and the regex
#   to use to filter logging by group name
GOBY_LOGGER_GROUP_REGEX_DICT = {
    'RELEASE': r'(?!(.*_internal.*|.*moos.*|.*engineering.*)).*',
    'ENGINEERING': r'(?!(.*_internal.*|.*moos.*)).*',
    'DEBUG': r'(?!(.*_internal.*)).*'
}


try:
    jaia_goby_log_level = os.environ['jaia_goby_log_level']
except:
    jaia_goby_log_level = 'RELEASE'


group_regex = GOBY_LOGGER_GROUP_REGEX_DICT[jaia_goby_log_level]
