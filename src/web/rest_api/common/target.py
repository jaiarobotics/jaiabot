##
## Parses target string into Protobuf Target object
##

import re
import jaiabot.messages.rest_api_pb2

from common.api_exception import APIException

def validate(target_str):
    pattern = re.compile(r'^(all|((h\d+|b\d+)(,(h\d+|b\d+))*))$')
    if not pattern.match(target_str):
        raise APIException(jaiabot.messages.rest_api_pb2.API_ERROR__INVALID_ACTION, "Target '" + target_str + "' is invalid. It must be 'all', or a comma-delimited string of 'hN' for hub, 'bM' for bot N. For example 'h1,b2,b3,b4' or 'b1,b10'")

def parse(target_str):
    validate(target_str)
    
    target = jaiabot.messages.rest_api_pb2.APIRequest.Nodes()
    
    if target_str.strip() == "all":
        target.all = True
        return target
    
    elements = target_str.split(',')

    # use a set to remove duplicates
    bots=set()
    hubs=set()
    for element in elements:
        element = element.strip()
        if re.match(r"h\d+", element):
            hub_number = int(re.findall(r"\d+", element)[0])
            hubs.add(hub_number)
        elif re.match(r"b\d+", element):
            bot_number = int(re.findall(r"\d+", element)[0])
            bots.add(bot_number)

    for b in sorted(bots):
        target.bots.append(b)

    for b in sorted(hubs):
        target.hubs.append(b)

        
    return target
