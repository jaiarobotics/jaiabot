# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: goby/middleware/protobuf/udp_config.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from goby.protobuf import option_extensions_pb2 as goby_dot_protobuf_dot_option__extensions__pb2
from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='goby/middleware/protobuf/udp_config.proto',
  package='goby.middleware.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n)goby/middleware/protobuf/udp_config.proto\x12\x18goby.middleware.protobuf\x1a%goby/protobuf/option_extensions.proto\x1a\x1c\x64\x63\x63l/option_extensions.proto\"\xa5\x01\n\x12UDPOneToManyConfig\x12\x34\n\tbind_port\x18\x02 \x02(\rB!\x8a?\x1e\xa2\x06\x13UDP Port to bind on\xaa\x06\x05\x35\x30\x30\x30\x30\x12\x1c\n\rset_reuseaddr\x18\n \x01(\x08:\x05\x66\x61lse\x12\x1c\n\rset_broadcast\x18\x0b \x01(\x08:\x05\x66\x61lse\x12\x13\n\x04ipv6\x18\x0c \x01(\x08:\x05\x66\x61lse:\x08\xa2?\x05\xf2\x01\x02si\"\xe3\x02\n\x15UDPPointToPointConfig\x12^\n\tbind_port\x18\x02 \x01(\r:\x01\x30\x42H\x8a?E\xa2\x06:UDP Port to bind on. Defaults to dynamically allocated (0)\xaa\x06\x05\x35\x30\x30\x30\x30\x12N\n\x0eremote_address\x18\x05 \x02(\tB6\x8a?3\xa2\x06\"Remote address to transfer data to\xaa\x06\x0b\x31\x39\x32.168.1.1\x12?\n\x0bremote_port\x18\x06 \x02(\rB*\x8a?\'\xa2\x06\x1cUDP port for remote endpoint\xaa\x06\x05\x35\x30\x30\x30\x31\x12\x1c\n\rset_reuseaddr\x18\n \x01(\x08:\x05\x66\x61lse\x12\x1c\n\rset_broadcast\x18\x0b \x01(\x08:\x05\x66\x61lse\x12\x13\n\x04ipv6\x18\x0c \x01(\x08:\x05\x66\x61lse:\x08\xa2?\x05\xf2\x01\x02si')
  ,
  dependencies=[goby_dot_protobuf_dot_option__extensions__pb2.DESCRIPTOR,dccl_dot_option__extensions__pb2.DESCRIPTOR,])




_UDPONETOMANYCONFIG = _descriptor.Descriptor(
  name='UDPOneToManyConfig',
  full_name='goby.middleware.protobuf.UDPOneToManyConfig',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='bind_port', full_name='goby.middleware.protobuf.UDPOneToManyConfig.bind_port', index=0,
      number=2, type=13, cpp_type=3, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\212?\036\242\006\023UDP Port to bind on\252\006\00550000'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='set_reuseaddr', full_name='goby.middleware.protobuf.UDPOneToManyConfig.set_reuseaddr', index=1,
      number=10, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='set_broadcast', full_name='goby.middleware.protobuf.UDPOneToManyConfig.set_broadcast', index=2,
      number=11, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='ipv6', full_name='goby.middleware.protobuf.UDPOneToManyConfig.ipv6', index=3,
      number=12, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
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
  ],
  serialized_start=141,
  serialized_end=306,
)


_UDPPOINTTOPOINTCONFIG = _descriptor.Descriptor(
  name='UDPPointToPointConfig',
  full_name='goby.middleware.protobuf.UDPPointToPointConfig',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='bind_port', full_name='goby.middleware.protobuf.UDPPointToPointConfig.bind_port', index=0,
      number=2, type=13, cpp_type=3, label=1,
      has_default_value=True, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\212?E\242\006:UDP Port to bind on. Defaults to dynamically allocated (0)\252\006\00550000'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='remote_address', full_name='goby.middleware.protobuf.UDPPointToPointConfig.remote_address', index=1,
      number=5, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\212?3\242\006\"Remote address to transfer data to\252\006\013192.168.1.1'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='remote_port', full_name='goby.middleware.protobuf.UDPPointToPointConfig.remote_port', index=2,
      number=6, type=13, cpp_type=3, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\212?\'\242\006\034UDP port for remote endpoint\252\006\00550001'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='set_reuseaddr', full_name='goby.middleware.protobuf.UDPPointToPointConfig.set_reuseaddr', index=3,
      number=10, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='set_broadcast', full_name='goby.middleware.protobuf.UDPPointToPointConfig.set_broadcast', index=4,
      number=11, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='ipv6', full_name='goby.middleware.protobuf.UDPPointToPointConfig.ipv6', index=5,
      number=12, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
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
  ],
  serialized_start=309,
  serialized_end=664,
)

DESCRIPTOR.message_types_by_name['UDPOneToManyConfig'] = _UDPONETOMANYCONFIG
DESCRIPTOR.message_types_by_name['UDPPointToPointConfig'] = _UDPPOINTTOPOINTCONFIG
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

UDPOneToManyConfig = _reflection.GeneratedProtocolMessageType('UDPOneToManyConfig', (_message.Message,), dict(
  DESCRIPTOR = _UDPONETOMANYCONFIG,
  __module__ = 'goby.middleware.protobuf.udp_config_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.UDPOneToManyConfig)
  ))
_sym_db.RegisterMessage(UDPOneToManyConfig)

UDPPointToPointConfig = _reflection.GeneratedProtocolMessageType('UDPPointToPointConfig', (_message.Message,), dict(
  DESCRIPTOR = _UDPPOINTTOPOINTCONFIG,
  __module__ = 'goby.middleware.protobuf.udp_config_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.UDPPointToPointConfig)
  ))
_sym_db.RegisterMessage(UDPPointToPointConfig)


_UDPONETOMANYCONFIG.fields_by_name['bind_port']._options = None
_UDPONETOMANYCONFIG._options = None
_UDPPOINTTOPOINTCONFIG.fields_by_name['bind_port']._options = None
_UDPPOINTTOPOINTCONFIG.fields_by_name['remote_address']._options = None
_UDPPOINTTOPOINTCONFIG.fields_by_name['remote_port']._options = None
_UDPPOINTTOPOINTCONFIG._options = None
# @@protoc_insertion_point(module_scope)