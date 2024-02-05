# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/metadata.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/metadata.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\x1fjaiabot/messages/metadata.proto\x12\x10jaiabot.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\"P\n\x08XbeeInfo\x12\x1e\n\x07node_id\x18\x01 \x01(\t:\rNot Available\x12$\n\rserial_number\x18\x02 \x01(\t:\rNot Available\"\xb2\x02\n\x0e\x44\x65viceMetadata\x12\x0c\n\x04name\x18\x01 \x02(\t\x12\x41\n\x0fjaiabot_version\x18\x02 \x02(\x0b\x32(.jaiabot.protobuf.DeviceMetadata.Version\x12\x14\n\x0cgoby_version\x18\x03 \x02(\t\x12\x14\n\x0cmoos_version\x18\x04 \x02(\t\x12\x13\n\x0bivp_version\x18\x05 \x01(\t\x12\x14\n\x0cxbee_node_id\x18\x06 \x01(\t\x12\x1a\n\x12xbee_serial_number\x18\x07 \x01(\t\x1a\\\n\x07Version\x12\r\n\x05major\x18\x01 \x02(\t\x12\r\n\x05minor\x18\x02 \x02(\t\x12\r\n\x05patch\x18\x03 \x02(\t\x12\x10\n\x08git_hash\x18\x04 \x01(\t\x12\x12\n\ngit_branch\x18\x05 \x01(\t\":\n\x13QueryDeviceMetaData\x12#\n\x15query_metadata_status\x18\x01 \x01(\x08:\x04true')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,])




_XBEEINFO = _descriptor.Descriptor(
  name='XbeeInfo',
  full_name='jaiabot.protobuf.XbeeInfo',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='node_id', full_name='jaiabot.protobuf.XbeeInfo.node_id', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=True, default_value=_b("Not Available").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='serial_number', full_name='jaiabot.protobuf.XbeeInfo.serial_number', index=1,
      number=2, type=9, cpp_type=9, label=1,
      has_default_value=True, default_value=_b("Not Available").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=83,
  serialized_end=163,
)


_DEVICEMETADATA_VERSION = _descriptor.Descriptor(
  name='Version',
  full_name='jaiabot.protobuf.DeviceMetadata.Version',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='major', full_name='jaiabot.protobuf.DeviceMetadata.Version.major', index=0,
      number=1, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='minor', full_name='jaiabot.protobuf.DeviceMetadata.Version.minor', index=1,
      number=2, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='patch', full_name='jaiabot.protobuf.DeviceMetadata.Version.patch', index=2,
      number=3, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='git_hash', full_name='jaiabot.protobuf.DeviceMetadata.Version.git_hash', index=3,
      number=4, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='git_branch', full_name='jaiabot.protobuf.DeviceMetadata.Version.git_branch', index=4,
      number=5, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=380,
  serialized_end=472,
)

_DEVICEMETADATA = _descriptor.Descriptor(
  name='DeviceMetadata',
  full_name='jaiabot.protobuf.DeviceMetadata',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='name', full_name='jaiabot.protobuf.DeviceMetadata.name', index=0,
      number=1, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='jaiabot_version', full_name='jaiabot.protobuf.DeviceMetadata.jaiabot_version', index=1,
      number=2, type=11, cpp_type=10, label=2,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='goby_version', full_name='jaiabot.protobuf.DeviceMetadata.goby_version', index=2,
      number=3, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='moos_version', full_name='jaiabot.protobuf.DeviceMetadata.moos_version', index=3,
      number=4, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='ivp_version', full_name='jaiabot.protobuf.DeviceMetadata.ivp_version', index=4,
      number=5, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='xbee_node_id', full_name='jaiabot.protobuf.DeviceMetadata.xbee_node_id', index=5,
      number=6, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='xbee_serial_number', full_name='jaiabot.protobuf.DeviceMetadata.xbee_serial_number', index=6,
      number=7, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[_DEVICEMETADATA_VERSION, ],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=166,
  serialized_end=472,
)


_QUERYDEVICEMETADATA = _descriptor.Descriptor(
  name='QueryDeviceMetaData',
  full_name='jaiabot.protobuf.QueryDeviceMetaData',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='query_metadata_status', full_name='jaiabot.protobuf.QueryDeviceMetaData.query_metadata_status', index=0,
      number=1, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=True,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=474,
  serialized_end=532,
)

_DEVICEMETADATA_VERSION.containing_type = _DEVICEMETADATA
_DEVICEMETADATA.fields_by_name['jaiabot_version'].message_type = _DEVICEMETADATA_VERSION
DESCRIPTOR.message_types_by_name['XbeeInfo'] = _XBEEINFO
DESCRIPTOR.message_types_by_name['DeviceMetadata'] = _DEVICEMETADATA
DESCRIPTOR.message_types_by_name['QueryDeviceMetaData'] = _QUERYDEVICEMETADATA
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

XbeeInfo = _reflection.GeneratedProtocolMessageType('XbeeInfo', (_message.Message,), dict(
  DESCRIPTOR = _XBEEINFO,
  __module__ = 'jaiabot.messages.metadata_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.XbeeInfo)
  ))
_sym_db.RegisterMessage(XbeeInfo)

DeviceMetadata = _reflection.GeneratedProtocolMessageType('DeviceMetadata', (_message.Message,), dict(

  Version = _reflection.GeneratedProtocolMessageType('Version', (_message.Message,), dict(
    DESCRIPTOR = _DEVICEMETADATA_VERSION,
    __module__ = 'jaiabot.messages.metadata_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.DeviceMetadata.Version)
    ))
  ,
  DESCRIPTOR = _DEVICEMETADATA,
  __module__ = 'jaiabot.messages.metadata_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.DeviceMetadata)
  ))
_sym_db.RegisterMessage(DeviceMetadata)
_sym_db.RegisterMessage(DeviceMetadata.Version)

QueryDeviceMetaData = _reflection.GeneratedProtocolMessageType('QueryDeviceMetaData', (_message.Message,), dict(
  DESCRIPTOR = _QUERYDEVICEMETADATA,
  __module__ = 'jaiabot.messages.metadata_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.QueryDeviceMetaData)
  ))
_sym_db.RegisterMessage(QueryDeviceMetaData)


# @@protoc_insertion_point(module_scope)
