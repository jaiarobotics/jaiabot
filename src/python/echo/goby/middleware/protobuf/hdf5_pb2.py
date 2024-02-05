# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: goby/middleware/protobuf/hdf5.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from goby.middleware.protobuf import app_config_pb2 as goby_dot_middleware_dot_protobuf_dot_app__config__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='goby/middleware/protobuf/hdf5.proto',
  package='goby.middleware.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n#goby/middleware/protobuf/hdf5.proto\x12\x18goby.middleware.protobuf\x1a)goby/middleware/protobuf/app_config.proto\"r\n\nHDF5Config\x12\x30\n\x03\x61pp\x18\x01 \x01(\x0b\x32#.goby.middleware.protobuf.AppConfig\x12\x13\n\x0boutput_file\x18\n \x02(\t\x12\x12\n\ninput_file\x18\x1e \x03(\t*\t\x08\xe8\x07\x10\x80\x80\x80\x80\x02')
  ,
  dependencies=[goby_dot_middleware_dot_protobuf_dot_app__config__pb2.DESCRIPTOR,])




_HDF5CONFIG = _descriptor.Descriptor(
  name='HDF5Config',
  full_name='goby.middleware.protobuf.HDF5Config',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='app', full_name='goby.middleware.protobuf.HDF5Config.app', index=0,
      number=1, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='output_file', full_name='goby.middleware.protobuf.HDF5Config.output_file', index=1,
      number=10, type=9, cpp_type=9, label=2,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='input_file', full_name='goby.middleware.protobuf.HDF5Config.input_file', index=2,
      number=30, type=9, cpp_type=9, label=3,
      has_default_value=False, default_value=[],
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
  is_extendable=True,
  syntax='proto2',
  extension_ranges=[(1000, 536870912), ],
  oneofs=[
  ],
  serialized_start=108,
  serialized_end=222,
)

_HDF5CONFIG.fields_by_name['app'].message_type = goby_dot_middleware_dot_protobuf_dot_app__config__pb2._APPCONFIG
DESCRIPTOR.message_types_by_name['HDF5Config'] = _HDF5CONFIG
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

HDF5Config = _reflection.GeneratedProtocolMessageType('HDF5Config', (_message.Message,), dict(
  DESCRIPTOR = _HDF5CONFIG,
  __module__ = 'goby.middleware.protobuf.hdf5_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.HDF5Config)
  ))
_sym_db.RegisterMessage(HDF5Config)


# @@protoc_insertion_point(module_scope)
