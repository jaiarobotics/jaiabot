# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: goby/middleware/protobuf/frontseat_config.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2
from goby.protobuf import option_extensions_pb2 as goby_dot_protobuf_dot_option__extensions__pb2
from goby.middleware.protobuf import frontseat_data_pb2 as goby_dot_middleware_dot_protobuf_dot_frontseat__data__pb2
from goby.middleware.protobuf import geographic_pb2 as goby_dot_middleware_dot_protobuf_dot_geographic__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='goby/middleware/protobuf/frontseat_config.proto',
  package='goby.middleware.frontseat.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n/goby/middleware/protobuf/frontseat_config.proto\x12\"goby.middleware.frontseat.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\x1a%goby/protobuf/option_extensions.proto\x1a-goby/middleware/protobuf/frontseat_data.proto\x1a)goby/middleware/protobuf/geographic.proto\"\x89\x07\n\x06\x43onfig\x12\x0c\n\x04name\x18\x01 \x01(\t\x12\x35\n\x06origin\x18\x02 \x01(\x0b\x32%.goby.middleware.protobuf.LatLonPoint\x12\x42\n\x04type\x18\x03 \x01(\x0e\x32/.goby.middleware.frontseat.protobuf.VehicleType:\x03\x41UV\x12t\n\x0crequire_helm\x18\n \x01(\x08:\x04trueBX\x8a?U\xa2\x06RRequire the IvP Helm even for listening mission where the frontseat is in control.\x12\xa3\x01\n\x14helm_running_timeout\x18\x0b \x01(\x01:\x02\x31\x30\x42\x80\x01\xa2?\x06\xf2\x01\x03\n\x01T\x8a?t\xa2\x06qIf `require_helm`, how long (in seconds) to wait for the IvP Helm to start before moving to the Helm Error state.\x12\xa3\x01\n\x1b\x66rontseat_connected_timeout\x18\x0c \x01(\x01:\x02\x31\x30\x42z\xa2?\x06\xf2\x01\x03\n\x01T\x8a?n\xa2\x06kHow long (in seconds) to wait for the Frontseat to be connected before moving to the Frontseat Error state.\x12\x99\x01\n\rstatus_period\x18\r \x01(\r:\x01\x35\x42\x7f\xa2?\x06\xf2\x01\x03\n\x01T\x8a?s\xa2\x06pSeconds between publishing the status of iFrontseat. The special value 0 disables posting of the status message.\x12g\n\rexit_on_error\x18\x15 \x01(\x08:\x05\x66\x61lseBI\x8a?F\xa2\x06\x43If true, exit the application if it enters one of the error states.\x12\x1a\n\x0fsim_warp_factor\x18\x1e \x01(\x05:\x01\x31*\t\x08\xe8\x07\x10\x80\x80\x80\x80\x02:\x08\xa2?\x05\xf2\x01\x02si')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,goby_dot_protobuf_dot_option__extensions__pb2.DESCRIPTOR,goby_dot_middleware_dot_protobuf_dot_frontseat__data__pb2.DESCRIPTOR,goby_dot_middleware_dot_protobuf_dot_geographic__pb2.DESCRIPTOR,])




_CONFIG = _descriptor.Descriptor(
  name='Config',
  full_name='goby.middleware.frontseat.protobuf.Config',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='name', full_name='goby.middleware.frontseat.protobuf.Config.name', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='origin', full_name='goby.middleware.frontseat.protobuf.Config.origin', index=1,
      number=2, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='type', full_name='goby.middleware.frontseat.protobuf.Config.type', index=2,
      number=3, type=14, cpp_type=8, label=1,
      has_default_value=True, default_value=10,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='require_helm', full_name='goby.middleware.frontseat.protobuf.Config.require_helm', index=3,
      number=10, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=True,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\212?U\242\006RRequire the IvP Helm even for listening mission where the frontseat is in control.'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='helm_running_timeout', full_name='goby.middleware.frontseat.protobuf.Config.helm_running_timeout', index=4,
      number=11, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(10),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\006\362\001\003\n\001T\212?t\242\006qIf `require_helm`, how long (in seconds) to wait for the IvP Helm to start before moving to the Helm Error state.'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='frontseat_connected_timeout', full_name='goby.middleware.frontseat.protobuf.Config.frontseat_connected_timeout', index=5,
      number=12, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(10),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\006\362\001\003\n\001T\212?n\242\006kHow long (in seconds) to wait for the Frontseat to be connected before moving to the Frontseat Error state.'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='status_period', full_name='goby.middleware.frontseat.protobuf.Config.status_period', index=6,
      number=13, type=13, cpp_type=3, label=1,
      has_default_value=True, default_value=5,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\006\362\001\003\n\001T\212?s\242\006pSeconds between publishing the status of iFrontseat. The special value 0 disables posting of the status message.'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='exit_on_error', full_name='goby.middleware.frontseat.protobuf.Config.exit_on_error', index=7,
      number=21, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\212?F\242\006CIf true, exit the application if it enters one of the error states.'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='sim_warp_factor', full_name='goby.middleware.frontseat.protobuf.Config.sim_warp_factor', index=8,
      number=30, type=5, cpp_type=1, label=1,
      has_default_value=True, default_value=1,
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
  is_extendable=True,
  syntax='proto2',
  extension_ranges=[(1000, 536870912), ],
  oneofs=[
  ],
  serialized_start=247,
  serialized_end=1152,
)

_CONFIG.fields_by_name['origin'].message_type = goby_dot_middleware_dot_protobuf_dot_geographic__pb2._LATLONPOINT
_CONFIG.fields_by_name['type'].enum_type = goby_dot_middleware_dot_protobuf_dot_frontseat__data__pb2._VEHICLETYPE
DESCRIPTOR.message_types_by_name['Config'] = _CONFIG
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

Config = _reflection.GeneratedProtocolMessageType('Config', (_message.Message,), dict(
  DESCRIPTOR = _CONFIG,
  __module__ = 'goby.middleware.protobuf.frontseat_config_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.frontseat.protobuf.Config)
  ))
_sym_db.RegisterMessage(Config)


_CONFIG.fields_by_name['require_helm']._options = None
_CONFIG.fields_by_name['helm_running_timeout']._options = None
_CONFIG.fields_by_name['frontseat_connected_timeout']._options = None
_CONFIG.fields_by_name['status_period']._options = None
_CONFIG.fields_by_name['exit_on_error']._options = None
_CONFIG._options = None
# @@protoc_insertion_point(module_scope)