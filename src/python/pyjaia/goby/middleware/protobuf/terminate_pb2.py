# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: goby/middleware/protobuf/terminate.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor.FileDescriptor(
  name='goby/middleware/protobuf/terminate.proto',
  package='goby.middleware.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n(goby/middleware/protobuf/terminate.proto\x12\x18goby.middleware.protobuf\";\n\x10TerminateRequest\x12\x13\n\x0btarget_name\x18\x01 \x01(\t\x12\x12\n\ntarget_pid\x18\x02 \x01(\r\"<\n\x11TerminateResponse\x12\x13\n\x0btarget_name\x18\x01 \x01(\t\x12\x12\n\ntarget_pid\x18\x02 \x01(\r\"\xe2\x01\n\x0fTerminateResult\x12\x13\n\x0btarget_name\x18\x01 \x01(\t\x12\x12\n\ntarget_pid\x18\x02 \x01(\r\x12@\n\x06result\x18\x03 \x02(\x0e\x32\x30.goby.middleware.protobuf.TerminateResult.Result\"d\n\x06Result\x12\x15\n\x11PROCESS_RESPONDED\x10\x01\x12\x18\n\x14PROCESS_CLEANLY_QUIT\x10\x02\x12\x14\n\x10TIMEOUT_RESPONSE\x10\x03\x12\x13\n\x0fTIMEOUT_RUNNING\x10\x04')
)



_TERMINATERESULT_RESULT = _descriptor.EnumDescriptor(
  name='Result',
  full_name='goby.middleware.protobuf.TerminateResult.Result',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='PROCESS_RESPONDED', index=0, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='PROCESS_CLEANLY_QUIT', index=1, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='TIMEOUT_RESPONSE', index=2, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='TIMEOUT_RUNNING', index=3, number=4,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=320,
  serialized_end=420,
)
_sym_db.RegisterEnumDescriptor(_TERMINATERESULT_RESULT)


_TERMINATEREQUEST = _descriptor.Descriptor(
  name='TerminateRequest',
  full_name='goby.middleware.protobuf.TerminateRequest',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='target_name', full_name='goby.middleware.protobuf.TerminateRequest.target_name', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='target_pid', full_name='goby.middleware.protobuf.TerminateRequest.target_pid', index=1,
      number=2, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
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
  serialized_start=70,
  serialized_end=129,
)


_TERMINATERESPONSE = _descriptor.Descriptor(
  name='TerminateResponse',
  full_name='goby.middleware.protobuf.TerminateResponse',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='target_name', full_name='goby.middleware.protobuf.TerminateResponse.target_name', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='target_pid', full_name='goby.middleware.protobuf.TerminateResponse.target_pid', index=1,
      number=2, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
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
  serialized_start=131,
  serialized_end=191,
)


_TERMINATERESULT = _descriptor.Descriptor(
  name='TerminateResult',
  full_name='goby.middleware.protobuf.TerminateResult',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='target_name', full_name='goby.middleware.protobuf.TerminateResult.target_name', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='target_pid', full_name='goby.middleware.protobuf.TerminateResult.target_pid', index=1,
      number=2, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='result', full_name='goby.middleware.protobuf.TerminateResult.result', index=2,
      number=3, type=14, cpp_type=8, label=2,
      has_default_value=False, default_value=1,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
    _TERMINATERESULT_RESULT,
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=194,
  serialized_end=420,
)

_TERMINATERESULT.fields_by_name['result'].enum_type = _TERMINATERESULT_RESULT
_TERMINATERESULT_RESULT.containing_type = _TERMINATERESULT
DESCRIPTOR.message_types_by_name['TerminateRequest'] = _TERMINATEREQUEST
DESCRIPTOR.message_types_by_name['TerminateResponse'] = _TERMINATERESPONSE
DESCRIPTOR.message_types_by_name['TerminateResult'] = _TERMINATERESULT
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

TerminateRequest = _reflection.GeneratedProtocolMessageType('TerminateRequest', (_message.Message,), dict(
  DESCRIPTOR = _TERMINATEREQUEST,
  __module__ = 'goby.middleware.protobuf.terminate_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.TerminateRequest)
  ))
_sym_db.RegisterMessage(TerminateRequest)

TerminateResponse = _reflection.GeneratedProtocolMessageType('TerminateResponse', (_message.Message,), dict(
  DESCRIPTOR = _TERMINATERESPONSE,
  __module__ = 'goby.middleware.protobuf.terminate_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.TerminateResponse)
  ))
_sym_db.RegisterMessage(TerminateResponse)

TerminateResult = _reflection.GeneratedProtocolMessageType('TerminateResult', (_message.Message,), dict(
  DESCRIPTOR = _TERMINATERESULT,
  __module__ = 'goby.middleware.protobuf.terminate_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.TerminateResult)
  ))
_sym_db.RegisterMessage(TerminateResult)


# @@protoc_insertion_point(module_scope)