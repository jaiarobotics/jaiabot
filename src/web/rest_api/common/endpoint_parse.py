def parse(input_string):
    # The first colon separates HubID, so split at the first colon
    hub_id, remaining = input_string.split(':', 1)
    
    # The last colon separates the Port, so split at the last colon
    hostname, port = remaining.rsplit(':', 1)
    
    return {int(hub_id): (hostname, int(port))}

def parse_all(endpoint_str):
    strings=endpoint_str.split(',')
    merged_dict = {}
    for string in strings:
        parsed_dict = parse(string)
        merged_dict.update(parsed_dict)
    return merged_dict
