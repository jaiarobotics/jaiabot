# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/high_control.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf.internal import enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2
from goby.middleware.protobuf import frontseat_data_pb2 as goby_dot_middleware_dot_protobuf_dot_frontseat__data__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/high_control.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n#jaiabot/messages/high_control.proto\x12\x10jaiabot.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\x1a-goby/middleware/protobuf/frontseat_data.proto\"\xd2\x01\n\rRemoteControl\x12\x30\n\x08\x64uration\x18\x01 \x02(\x05\x42\x1e\xa2?\x1b)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\xc0\x82@\xf2\x01\x06\x12\x04time\x12J\n\x07heading\x18\n \x01(\x01:\x01\x30\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12\x39\n\x05speed\x18\x0b \x01(\x01:\x01\x30\x42\'\xa2?$ \x01)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00\x14@\xf2\x01\r\x12\x0blength/time:\x08\xa2?\x05\xf2\x01\x02si\"\xea\x02\n\x10\x44\x65siredSetpoints\x12,\n\x04type\x18\x01 \x02(\x0e\x32\x1e.jaiabot.protobuf.SetpointType\x12H\n\x0bhelm_course\x18\n \x01(\x0b\x32\x31.goby.middleware.frontseat.protobuf.DesiredCourseH\x00\x12\x39\n\x0eremote_control\x18\x0b \x01(\x0b\x32\x1f.jaiabot.protobuf.RemoteControlH\x00\x12$\n\ndive_depth\x18\x0c \x01(\x01\x42\x0e\xa2?\x0b\xf2\x01\x08\x12\x06lengthH\x00\x12\x12\n\x08throttle\x18\r \x01(\x01H\x00\x12&\n\x17is_helm_constant_course\x18\x02 \x01(\x08:\x05\x66\x61lse\x12&\n\x1eis_init_dive_constant_throttle\x18\x03 \x01(\x08:\x08\xa2?\x05\xf2\x01\x02siB\x0f\n\rsetpoint_data*\x85\x01\n\x0cSetpointType\x12\x11\n\rSETPOINT_STOP\x10\x00\x12\x15\n\x11SETPOINT_IVP_HELM\x10\x01\x12\x1b\n\x17SETPOINT_REMOTE_CONTROL\x10\x02\x12\x11\n\rSETPOINT_DIVE\x10\x03\x12\x1b\n\x17SETPOINT_POWERED_ASCENT\x10\x04')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,goby_dot_middleware_dot_protobuf_dot_frontseat__data__pb2.DESCRIPTOR,])

_SETPOINTTYPE = _descriptor.EnumDescriptor(
  name='SetpointType',
  full_name='jaiabot.protobuf.SetpointType',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='SETPOINT_STOP', index=0, number=0,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='SETPOINT_IVP_HELM', index=1, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='SETPOINT_REMOTE_CONTROL', index=2, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='SETPOINT_DIVE', index=3, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='SETPOINT_POWERED_ASCENT', index=4, number=4,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=713,
  serialized_end=846,
)
_sym_db.RegisterEnumDescriptor(_SETPOINTTYPE)

SetpointType = enum_type_wrapper.EnumTypeWrapper(_SETPOINTTYPE)
SETPOINT_STOP = 0
SETPOINT_IVP_HELM = 1
SETPOINT_REMOTE_CONTROL = 2
SETPOINT_DIVE = 3
SETPOINT_POWERED_ASCENT = 4



_REMOTECONTROL = _descriptor.Descriptor(
  name='RemoteControl',
  full_name='jaiabot.protobuf.RemoteControl',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='duration', full_name='jaiabot.protobuf.RemoteControl.duration', index=0,
      number=1, type=5, cpp_type=1, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\033)\000\000\000\000\000\000\360?1\000\000\000\000\000\300\202@\362\001\006\022\004time'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='heading', full_name='jaiabot.protobuf.RemoteControl.heading', index=1,
      number=10, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='speed', full_name='jaiabot.protobuf.RemoteControl.speed', index=2,
      number=11, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?$ \001)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000\024@\362\001\r\022\013length/time'), file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=_b('\242?\005\362\001\002si'),
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=135,
  serialized_end=345,
)


_DESIREDSETPOINTS = _descriptor.Descriptor(
  name='DesiredSetpoints',
  full_name='jaiabot.protobuf.DesiredSetpoints',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='type', full_name='jaiabot.protobuf.DesiredSetpoints.type', index=0,
      number=1, type=14, cpp_type=8, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='helm_course', full_name='jaiabot.protobuf.DesiredSetpoints.helm_course', index=1,
      number=10, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='remote_control', full_name='jaiabot.protobuf.DesiredSetpoints.remote_control', index=2,
      number=11, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='dive_depth', full_name='jaiabot.protobuf.DesiredSetpoints.dive_depth', index=3,
      number=12, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\013\362\001\010\022\006length'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='throttle', full_name='jaiabot.protobuf.DesiredSetpoints.throttle', index=4,
      number=13, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='is_helm_constant_course', full_name='jaiabot.protobuf.DesiredSetpoints.is_helm_constant_course', index=5,
      number=2, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='is_init_dive_constant_throttle', full_name='jaiabot.protobuf.DesiredSetpoints.is_init_dive_constant_throttle', index=6,
      number=3, type=8, cpp_type=7, label=1,
      has_default_value=False, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=_b('\242?\005\362\001\002si'),
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
    _descriptor.OneofDescriptor(
      name='setpoint_data', full_name='jaiabot.protobuf.DesiredSetpoints.setpoint_data',
      index=0, containing_type=None, fields=[]),
  ],
  serialized_start=348,
  serialized_end=710,
)

_DESIREDSETPOINTS.fields_by_name['type'].enum_type = _SETPOINTTYPE
_DESIREDSETPOINTS.fields_by_name['helm_course'].message_type = goby_dot_middleware_dot_protobuf_dot_frontseat__data__pb2._DESIREDCOURSE
_DESIREDSETPOINTS.fields_by_name['remote_control'].message_type = _REMOTECONTROL
_DESIREDSETPOINTS.oneofs_by_name['setpoint_data'].fields.append(
  _DESIREDSETPOINTS.fields_by_name['helm_course'])
_DESIREDSETPOINTS.fields_by_name['helm_course'].containing_oneof = _DESIREDSETPOINTS.oneofs_by_name['setpoint_data']
_DESIREDSETPOINTS.oneofs_by_name['setpoint_data'].fields.append(
  _DESIREDSETPOINTS.fields_by_name['remote_control'])
_DESIREDSETPOINTS.fields_by_name['remote_control'].containing_oneof = _DESIREDSETPOINTS.oneofs_by_name['setpoint_data']
_DESIREDSETPOINTS.oneofs_by_name['setpoint_data'].fields.append(
  _DESIREDSETPOINTS.fields_by_name['dive_depth'])
_DESIREDSETPOINTS.fields_by_name['dive_depth'].containing_oneof = _DESIREDSETPOINTS.oneofs_by_name['setpoint_data']
_DESIREDSETPOINTS.oneofs_by_name['setpoint_data'].fields.append(
  _DESIREDSETPOINTS.fields_by_name['throttle'])
_DESIREDSETPOINTS.fields_by_name['throttle'].containing_oneof = _DESIREDSETPOINTS.oneofs_by_name['setpoint_data']
DESCRIPTOR.message_types_by_name['RemoteControl'] = _REMOTECONTROL
DESCRIPTOR.message_types_by_name['DesiredSetpoints'] = _DESIREDSETPOINTS
DESCRIPTOR.enum_types_by_name['SetpointType'] = _SETPOINTTYPE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

RemoteControl = _reflection.GeneratedProtocolMessageType('RemoteControl', (_message.Message,), dict(
  DESCRIPTOR = _REMOTECONTROL,
  __module__ = 'jaiabot.messages.high_control_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.RemoteControl)
  ))
_sym_db.RegisterMessage(RemoteControl)

DesiredSetpoints = _reflection.GeneratedProtocolMessageType('DesiredSetpoints', (_message.Message,), dict(
  DESCRIPTOR = _DESIREDSETPOINTS,
  __module__ = 'jaiabot.messages.high_control_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.DesiredSetpoints)
  ))
_sym_db.RegisterMessage(DesiredSetpoints)


_REMOTECONTROL.fields_by_name['duration']._options = None
_REMOTECONTROL.fields_by_name['heading']._options = None
_REMOTECONTROL.fields_by_name['speed']._options = None
_REMOTECONTROL._options = None
_DESIREDSETPOINTS.fields_by_name['dive_depth']._options = None
_DESIREDSETPOINTS._options = None
# @@protoc_insertion_point(module_scope)
