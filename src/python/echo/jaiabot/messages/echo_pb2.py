# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/echo.proto

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
  name='jaiabot/messages/echo.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\x1bjaiabot/messages/echo.proto\x12\x10jaiabot.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\"o\n\x0b\x45\x63hoCommand\x12;\n\x04type\x18\x01 \x02(\x0e\x32-.jaiabot.protobuf.EchoCommand.EchoCommandType\"#\n\x0f\x45\x63hoCommandType\x12\x10\n\x0cTAKE_READING\x10\x00\"\'\n\x08\x45\x63hoData\x12\x1b\n\x0c\x64\x65vice_is_on\x18\x06 \x01(\x08:\x05\x66\x61lse')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,])



_ECHOCOMMAND_ECHOCOMMANDTYPE = _descriptor.EnumDescriptor(
  name='EchoCommandType',
  full_name='jaiabot.protobuf.EchoCommand.EchoCommandType',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='TAKE_READING', index=0, number=0,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=155,
  serialized_end=190,
)
_sym_db.RegisterEnumDescriptor(_ECHOCOMMAND_ECHOCOMMANDTYPE)


_ECHOCOMMAND = _descriptor.Descriptor(
  name='EchoCommand',
  full_name='jaiabot.protobuf.EchoCommand',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='type', full_name='jaiabot.protobuf.EchoCommand.type', index=0,
      number=1, type=14, cpp_type=8, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
    _ECHOCOMMAND_ECHOCOMMANDTYPE,
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=79,
  serialized_end=190,
)


_ECHODATA = _descriptor.Descriptor(
  name='EchoData',
  full_name='jaiabot.protobuf.EchoData',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='device_is_on', full_name='jaiabot.protobuf.EchoData.device_is_on', index=0,
      number=6, type=8, cpp_type=7, label=1,
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
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=192,
  serialized_end=231,
)

_ECHOCOMMAND.fields_by_name['type'].enum_type = _ECHOCOMMAND_ECHOCOMMANDTYPE
_ECHOCOMMAND_ECHOCOMMANDTYPE.containing_type = _ECHOCOMMAND
DESCRIPTOR.message_types_by_name['EchoCommand'] = _ECHOCOMMAND
DESCRIPTOR.message_types_by_name['EchoData'] = _ECHODATA
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

EchoCommand = _reflection.GeneratedProtocolMessageType('EchoCommand', (_message.Message,), dict(
  DESCRIPTOR = _ECHOCOMMAND,
  __module__ = 'jaiabot.messages.echo_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.EchoCommand)
  ))
_sym_db.RegisterMessage(EchoCommand)

EchoData = _reflection.GeneratedProtocolMessageType('EchoData', (_message.Message,), dict(
  DESCRIPTOR = _ECHODATA,
  __module__ = 'jaiabot.messages.echo_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.EchoData)
  ))
_sym_db.RegisterMessage(EchoData)


# @@protoc_insertion_point(module_scope)
