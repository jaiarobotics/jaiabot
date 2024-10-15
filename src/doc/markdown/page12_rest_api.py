import jaiabot.messages.rest_api_pb2
import google.protobuf.json_format
import json
from dataclasses import *
from typing import *


max_int32 = (2**31) - 1
max_uint32 = (2**32) - 1
max_int64 = (2**63) - 1
max_uint64 = (2**64) - 1
float_dummy = 1.2345


@dataclass
class Section:
    title: str
    content: str = ""
    subsections: List["Section"] = field(default_factory=list)


    def tag_id(self):
        return f'{id(self):x}'


    def text(self, level=1):
        anchor = f'<a id="{self.tag_id()}"></a>'

        content = f"\n{'#' * level} {self.title} {anchor}\n"

        content += self.content
        content += '\n'

        if level == 1:
            content += self.table_of_contents()

        for subsection in self.subsections:
            content += subsection.text(level + 1)

        return content
    

    def table_of_contents(self, level=1, number=1, generate_heading=True):
        content = ''

        if generate_heading:
            content += '#' * (level + 1) + ' Table of Contents\n'

        tag_name = '#' + self.tag_id()
        content += f"{'    ' * (level - 1)}{number}. [{self.title}]({tag_name})\n"

        for subsection_number, subsection in enumerate(self.subsections):
            content += subsection.table_of_contents(level + 1, subsection_number + 1, generate_heading=False)

        return content


def generate():
    document = Section(title='REST API')
    document.content = """
The Jaia REST API provides a way to query and command a JaiaBot fleet via web URL endpoints. These endpoints are directly generated from the APIRequest Protobuf message for input and APIResponse for output (jaiabot/src/lib/messages/rest_api.proto).

It accepts GET requests for the subset of requests that only have singular (non-repeated) non-recursive (no submessages) data. This is generally suitable for simple requests (e.g. STOP all bots, query status, etc) but not for more complicated MISSION_PLAN type commands.

It also accepts POST for all requests, using JSON (which is required for the more complicated messages).


There are 2 variants of the API:

- "simple" variant (e.g., https://fleet0.jaia.tech/jaia/v1/status/all) where the action and the target(s) are specified in the url and any data may be passed via GET arguments (subject to limitations mentioned above). This allows for easy testing as the entire request is contained within the URL. (The "simple" version can be used for POST requests as well. Here the POST data (if any) contains the "action" submessage contents. This option is not documented in detail below, but will follow a similar pattern to the "full" variant).
- "full" variant  (e.g., https://fleet0.jaia.tech/jaia/v1)  where the entire request is POSTed as a JSON formatted APIRequest Protobuf message.
"""

    simple_section = Section(title="Simple variant (GET) formatting")
    simple_section.content="""
The URL expected for the simple variant of the API is:

```
https://fleet<N>.jaia.tech/jaia/v1/<action>/<target>?api_key=<API_KEY_STRING>&var1=val1&var2=val2
```

Where:
- `fleet<N>` is the fleet to command
- `<action>` is one of the specified actions (below)
- `<target>` is the target bots and or hubs in the following format:
    - 'all' for all known bots and the hub (if relevant)
    - comma separated list of 'bN' and/or 'hN' where N is the bot/hub ID, e.g., 'b1,b2,b3' would target bots 1-3, or 'h1,b3' would target hub 1  and bot 3
- api_key is the private shared key to use the API
- var1 and var2 are variables affecting the action (see action documentation below)
- val1 and val2 are the values for var1 and var2, respectively.
"""

    full_section = Section(title="Full variant (POST) formatting")
    full_section.content = """
The URL expected for the full variant of the API is:

```
https://fleet<N>.jaia.tech/jaia/v1
```

All data are expected to be sent as a POST request using the JSON formatted version of the APIRequest message as the POST variable 'json'. For example, to request status from all the bots you would POST the following to the above URL, for example using Python to command Fleet0:


```
#!/usr/bin/env python3
import requests

jaia_request={"target": {"all": True}, "status": True, "api_key": "4vS6s2jnulxVjrKSB-__tQ"}

res = requests.post(f'https://fleet0.jaia.tech/jaia/v1', json=jaia_request)
```

Key for placeholders: 
 - `<API_KEY_STRING>`: API Key string field
 - `<STRING>`: String field
 - `False`: Boolean field
 - `{float_dummy}`: Floating point field
 - `{max_int32}`: Int32 field
 - `{max_uint32}`: UInt32 field
 - `{max_int64}`: Int64 field
 - `{max_uint64}`: UInt64 field

See the action documentation below for more details.
"""

    request_section = Section(title='Request Actions')
    for field in jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.oneofs_by_name['action'].fields:
        request_section.subsections.append(generate_request_section(field.name))

    response_section = Section(title='Response Actions')
    for field in jaiabot.messages.rest_api_pb2.APIResponse.DESCRIPTOR.oneofs_by_name['action'].fields:
        response_section.subsections.append(generate_response_section(field.name))

    document.subsections = [
        simple_section,
        full_section,
        request_section,
        response_section
    ]

    return document.text()

def generate_request_section(action: str):
    field = jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.fields_by_name[action]
    doc = field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.doc
    
    content = ''
    content += field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.doc

    section = Section(title=f"{action}", content=content)
    section.subsections.append(generate_simple_variant(action))
    section.subsections.extend(generate_full_variant(action))

    return section

def generate_response_section(action: str):
    section = Section(action)

    field = jaiabot.messages.rest_api_pb2.APIResponse.DESCRIPTOR.fields_by_name[action]
    section.content += field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.doc

    jaia_response = jaiabot.messages.rest_api_pb2.APIResponse()

    oneofs = discover_all_oneofs(jaia_response, action)
   

    def add_variant(title: str, jaia_response, action, oneof_selection):
        variant_section = Section(title=title)

        enums = introspect_and_populate(jaia_response, action, oneof_selection)
        
        del jaia_response.target.hubs[:]
        jaia_response.target.hubs.append(1)
        del jaia_response.target.bots[:]
        for i in range(1,3):
            jaia_response.target.bots.append(i)
        
        # Convert the message to a dictionary
        response_json = google.protobuf.json_format.MessageToDict(jaia_response, preserving_proto_field_name=True)
            
        enum_first_val=dict()
        for type,val_list in enums.items():
            enum_first_val[val_list[0][0]] = type
            # Replace certain dummy values
            replace_dummy_values(response_json, enum_first_val)    

        response_json["request"] = {'copy of original request': '...'}

        json_section = Section(title='JSON')
        json_section.content = f"""
```
{json.dumps(response_json, indent=2)}
```
"""
        variant_section.subsections.append(json_section)

        enum_section = generate_enum_section(enums)
        if enum_section:
            variant_section.subsections.append(enum_section)

        return variant_section

    oneof_selection=dict()
    section.subsections.append(add_variant("Response Syntax", jaia_response, action, oneof_selection))
    
    for oneof_name, oneof_desc in oneofs.items():
        oneof_selection[oneof_name]=oneof_desc.fields[0].name

    for oneof_name, oneof_desc in oneofs.items():
        for oneof_field in oneof_desc.fields:
            presence = oneof_field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.presence
            if presence == jaiabot.messages.option_extensions_pb2.RestAPI.GUARANTEED:
                oneof_selection[oneof_name]=oneof_field.name
                section.subsections.append(add_variant(f"Variant: {oneof_name} = {oneof_field.name}", jaia_response, action, oneof_selection))

    return section


def generate_simple_variant(action):
    section = Section(title="Simple API Syntax (GET)")

    get_vars=dict()
    get_vars["api_key"]="<API_KEY_STRING>"
    
    action_field_desc = jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.fields_by_name[action]
    jaia_request = jaiabot.messages.rest_api_pb2.APIRequest()

    enums=dict()
    
    if action_field_desc.type != google.protobuf.descriptor.FieldDescriptor.TYPE_BOOL:
        jaia_request_action = getattr(jaia_request, action_field_desc.name)
        for field in jaia_request_action.DESCRIPTOR.fields:
            presence = field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.presence
            if presence != jaiabot.messages.option_extensions_pb2.RestAPI.GUARANTEED:
                continue
            elif field.label == google.protobuf.descriptor.FieldDescriptor.LABEL_REPEATED:
                continue
            elif field.cpp_type == field.CPPTYPE_INT32:
                get_vars[field.name] = '<INT32>'
            elif field.cpp_type == field.CPPTYPE_INT64:
                get_vars[field.name] = '<INT64>'
            elif field.cpp_type == field.CPPTYPE_UINT32:
                get_vars[field.name] = '<UINT32>'
            elif field.cpp_type == field.CPPTYPE_UINT64:
                get_vars[field.name] = '<UINT64>'
            elif field.cpp_type == field.CPPTYPE_DOUBLE:
                get_vars[field.name] = '<DOUBLE>'
            elif field.cpp_type == field.CPPTYPE_FLOAT:
                get_vars[field.name] = '<FLOAT>'
            elif field.type == field.TYPE_ENUM:
                enum_type = field.enum_type
                get_vars[field.name] = f'<ENUM {enum_type.name}>'
                add_enum(enums, field.enum_type)

            elif field.cpp_type == field.CPPTYPE_STRING:
                get_vars[field.name] = '<STRING>' 

    get_str=''

    for var,val in get_vars.items():
        get_str += f'{var}=' + val +'&'
        
    if len(get_str) > 0:
        get_str = '?' + get_str[:-1]
        
    section.content = f"""
```
https://fleet<N>.jaia.tech/jaia/v1/{action}/<target>{get_str}
```
"""
    
    enum_section = generate_enum_section(enums)
    if enum_section:
        section.subsections.append(enum_section)

    return section
    

def generate_enum_section(enums):
    if len(enums) == 0:
        return None

    content=''

    for type,val_list in enums.items():
        content += f' - `<ENUM {type}>`: ' + ", ".join(v[0] for v in val_list if v[1]) + '\n'
        
    return Section(title='Enumerations', content=content)


def generate_full_variant(action):
    jaia_request = jaiabot.messages.rest_api_pb2.APIRequest()

    oneofs = discover_all_oneofs(jaia_request, action)
   
    def add_variant(title: str, jaia_request, action, oneof_selection):
        variant_section = Section(title=title)

        enums = introspect_and_populate(jaia_request, action, oneof_selection)
        
        jaia_request.api_key="<API_KEY_STRING>"
        del jaia_request.target.hubs[:]
        jaia_request.target.hubs.append(1)
        del jaia_request.target.bots[:]
        for i in range(1,3):
            jaia_request.target.bots.append(i)
        jaia_request.target.all=False
        
        # Convert the message to a dictionary
        request_json = google.protobuf.json_format.MessageToDict(jaia_request, preserving_proto_field_name=True)
            
        enum_first_val=dict()
        for type,val_list in enums.items():
            enum_first_val[val_list[0][0]] = type
            # Replace certain dummy values
            replace_dummy_values(request_json, enum_first_val)    

        variant_section.subsections.append(Section(title="JSON", 
                               content=f"""
```
{json.dumps(request_json, indent=2)}
```
"""))

        enum_section = generate_enum_section(enums)
        if enum_section:
            variant_section.subsections.append(enum_section)

        return variant_section

    oneof_selection=dict()
    sections = []
    sections.append(add_variant("Full API Syntax (POST)", jaia_request, action, oneof_selection))

    for oneof_name, oneof_desc in oneofs.items():
        oneof_selection[oneof_name]=oneof_desc.fields[0].name

    for oneof_name, oneof_desc in oneofs.items():
        for oneof_field in oneof_desc.fields:
            presence = oneof_field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.presence
            if presence == jaiabot.messages.option_extensions_pb2.RestAPI.GUARANTEED:
                oneof_selection[oneof_name]=oneof_field.name
                doc = oneof_field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.doc

                variant_section = add_variant(f"Variant: {oneof_name} = {oneof_field.name}", jaia_request, action, oneof_selection)
                variant_section.content += f"{doc}\n"

                sections.append(variant_section)

                
    field = jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.fields_by_name[action]
    ex_req = field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.example.request
    ex_resp = field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.example.response

    if ex_req and ex_resp:
        example_section = Section(title="Example")
        example_section.subsections.append(Section(title='Request JSON', 
                                                   content=f"""
```
{json.dumps(json.loads(ex_req), indent=2)}
```
"""))
        example_section.subsections.append(Section(title='Response JSON',
                                                   content=f"""
```
{json.dumps(json.loads(ex_resp), indent=2)}
```
"""))
        
        sections.append(example_section)

    return sections

    



# enums is dictionary of enum type -> tuple of (value, is_guaranteed)
def add_enum(enums, enum_type):
    enums[enum_type.name]=list()
    for val, val_desc in enum_type.values_by_name.items():
        presence = val_desc.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.ev].rest_api.presence
        if presence == jaiabot.messages.option_extensions_pb2.RestAPI.GUARANTEED or enum_type.full_name[0:4] == 'goby':
            enums[enum_type.name].append((val, True))
        else:
            enums[enum_type.name].append((val, False))
            

def discover_all_oneofs(message, action):
    oneofs=dict()
    # Function to recursively populate the message with dummy values
    def discover_oneofs(desc, action):
        for field in desc.fields: 
            if field.containing_oneof is not None and field.containing_oneof.name != 'action':
                oneofs[field.containing_oneof.name] = field.containing_oneof
            if field.type == field.TYPE_MESSAGE:
                if (field.containing_oneof != jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.oneofs_by_name['action'] and field.containing_oneof != jaiabot.messages.rest_api_pb2.APIResponse.DESCRIPTOR.oneofs_by_name['action']) or field.name == action:
                    discover_oneofs(field.message_type, action)
                    
    discover_oneofs(message.DESCRIPTOR, action) 
    return oneofs

            
def introspect_and_populate(message, action, oneof_selection):

    enums=dict()
    
    # Function to recursively populate the message with dummy values
    def populate_message(msg, action):
        n_repeats = 2
        for field in msg.DESCRIPTOR.fields:
            presence = field.GetOptions().Extensions[jaiabot.messages.option_extensions_pb2.field].rest_api.presence
            if presence != jaiabot.messages.option_extensions_pb2.RestAPI.GUARANTEED:
                continue

            if field.containing_oneof is not None:
                if field.containing_oneof == jaiabot.messages.rest_api_pb2.APIRequest.DESCRIPTOR.oneofs_by_name['action'] or field.containing_oneof == jaiabot.messages.rest_api_pb2.APIResponse.DESCRIPTOR.oneofs_by_name['action']:
                    if field.name != action:
                        continue
                else:
                    try:
                        if oneof_selection[field.containing_oneof.name] != field.name:
                            continue
                    except:
                        continue
            
            if field.type == field.TYPE_MESSAGE:
                # Recursively populate nested messages
                nested_msg = getattr(msg, field.name)
                if field.label == field.LABEL_REPEATED:
                    for rep in range(0, n_repeats):
                        nested_msg.add()
                        populate_message(nested_msg[-1], action)
                else:
                    populate_message(nested_msg, action)
            elif field.label == field.LABEL_REPEATED:
                for rep in range(0, n_repeats):
                    # Populate repeated fields with one dummy value
                    if field.type == field.TYPE_STRING:
                        getattr(msg, field.name).append("<STRING>")
                    elif field.cpp_type == field.CPPTYPE_INT32:
                        getattr(msg, field.name).append(max_int32)
                    elif field.cpp_type == field.CPPTYPE_INT64:
                        getattr(msg, field.name).append(max_int64)
                    elif field.cpp_type == field.CPPTYPE_UINT32:
                        getattr(msg, field.name).append(max_uint32)
                    elif field.cpp_type == field.CPPTYPE_UINT64:
                        getattr(msg, field.name).append(max_uint64)
                    elif field.cpp_type in (field.CPPTYPE_FLOAT, 
                                            field.CPPTYPE_DOUBLE):
                        getattr(msg, field.name).append(float_dummy)
                    elif field.cpp_type == field.CPPTYPE_BOOL:
                        getattr(msg, field.name).append(True)
                    elif field.cpp_type == field.CPPTYPE_ENUM:
                        add_enum(enums, field.enum_type)
                        enum_value = field.enum_type.values[0].number
                        getattr(msg, field.name).append(enum_value)
                    
            else:
                # Populate scalar fields with dummy values
                if field.type == field.TYPE_STRING:
                    setattr(msg, field.name, "<STRING>")
                elif field.cpp_type == field.CPPTYPE_INT32:
                    setattr(msg, field.name, max_int32)
                elif field.cpp_type == field.CPPTYPE_INT64:
                    setattr(msg, field.name, max_int64)
                elif field.cpp_type == field.CPPTYPE_UINT32:
                    setattr(msg, field.name, max_uint32)
                elif field.cpp_type == field.CPPTYPE_UINT64:
                    setattr(msg, field.name, max_uint64)
                elif field.cpp_type in (field.CPPTYPE_FLOAT, 
                                        field.CPPTYPE_DOUBLE):
                    setattr(msg, field.name, float_dummy)
                elif field.cpp_type == field.CPPTYPE_BOOL:
                    setattr(msg, field.name, True)
                elif field.cpp_type == field.CPPTYPE_ENUM:

                    enum_value = field.enum_type.values[0].number
                    setattr(msg, field.name, enum_value)
                    add_enum(enums, field.enum_type)
                    
    # Populate the message
    populate_message(message, action)
    
    return enums



def replace_dummy_values(d, enum_first_val):
    if isinstance(d, dict):
        for key, value in d.items():
            if isinstance(value, dict):
                replace_dummy_values(value, enum_first_val)
            elif isinstance(value, list):
                for i in range(len(value)):
                    if isinstance(value[i], dict):
                        replace_dummy_values(value[i], enum_first_val)
                    elif isinstance(value[i], str):
                        if value[i] in enum_first_val:
                            value[i] = f"<ENUM {enum_first_val[value[i]]}>"
            elif isinstance(value, str):
                if value in enum_first_val:
                    d[key] = f"<ENUM {enum_first_val[value]}>"

