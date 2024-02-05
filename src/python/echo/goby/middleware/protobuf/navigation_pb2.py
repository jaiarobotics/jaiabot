# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: goby/middleware/protobuf/navigation.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2
from goby.middleware.protobuf import geographic_pb2 as goby_dot_middleware_dot_protobuf_dot_geographic__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='goby/middleware/protobuf/navigation.proto',
  package='goby.middleware.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n)goby/middleware/protobuf/navigation.proto\x12\x18goby.middleware.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\x1a)goby/middleware/protobuf/geographic.proto\"M\n\x0b\x44\x61tumUpdate\x12\x34\n\x05\x64\x61tum\x18\x01 \x02(\x0b\x32%.goby.middleware.protobuf.LatLonPoint:\x08\xa2?\x05\xf2\x01\x02si')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,goby_dot_middleware_dot_protobuf_dot_geographic__pb2.DESCRIPTOR,])




_DATUMUPDATE = _descriptor.Descriptor(
  name='DatumUpdate',
  full_name='goby.middleware.protobuf.DatumUpdate',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='datum', full_name='goby.middleware.protobuf.DatumUpdate.datum', index=0,
      number=1, type=11, cpp_type=10, label=2,
      has_default_value=False, default_value=None,
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
  serialized_start=144,
  serialized_end=221,
)

_DATUMUPDATE.fields_by_name['datum'].message_type = goby_dot_middleware_dot_protobuf_dot_geographic__pb2._LATLONPOINT
DESCRIPTOR.message_types_by_name['DatumUpdate'] = _DATUMUPDATE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

DatumUpdate = _reflection.GeneratedProtocolMessageType('DatumUpdate', (_message.Message,), dict(
  DESCRIPTOR = _DATUMUPDATE,
  __module__ = 'goby.middleware.protobuf.navigation_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.DatumUpdate)
  ))
_sym_db.RegisterMessage(DatumUpdate)


_DATUMUPDATE._options = None
# @@protoc_insertion_point(module_scope)
