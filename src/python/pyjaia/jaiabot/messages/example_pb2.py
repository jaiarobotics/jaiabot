# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/example.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/example.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\x1ejaiabot/messages/example.proto\x12\x10jaiabot.protobuf\"\x1f\n\x07\x45xample\x12\t\n\x01\x61\x18\x01 \x01(\x05\x12\t\n\x01\x62\x18\x02 \x02(\x01')
)




_EXAMPLE = _descriptor.Descriptor(
  name='Example',
  full_name='jaiabot.protobuf.Example',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='a', full_name='jaiabot.protobuf.Example.a', index=0,
      number=1, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='b', full_name='jaiabot.protobuf.Example.b', index=1,
      number=2, type=1, cpp_type=5, label=2,
      has_default_value=False, default_value=float(0),
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
  serialized_start=52,
  serialized_end=83,
)

DESCRIPTOR.message_types_by_name['Example'] = _EXAMPLE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

Example = _reflection.GeneratedProtocolMessageType('Example', (_message.Message,), dict(
  DESCRIPTOR = _EXAMPLE,
  __module__ = 'jaiabot.messages.example_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.Example)
  ))
_sym_db.RegisterMessage(Example)


# @@protoc_insertion_point(module_scope)
