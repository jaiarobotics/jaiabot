# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/feather.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()




DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/feather.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\x1ejaiabot/messages/feather.proto\x12\x10jaiabot.protobuf\"\xfb\x05\n\x0bLoRaMessage\x12\x0b\n\x03src\x18\x01 \x02(\x05\x12\x0c\n\x04\x64\x65st\x18\x02 \x02(\x05\x12\x0c\n\x04\x64\x61ta\x18\x03 \x01(\x0c\x12\x42\n\x04type\x18\x04 \x02(\x0e\x32).jaiabot.protobuf.LoRaMessage.MessageType:\tLORA_DATA\x12\n\n\x02id\x18\x05 \x01(\x05\x12\r\n\x05\x66lags\x18\x06 \x01(\x05\x12\x0c\n\x04rssi\x18\x07 \x01(\x11\x12\x1b\n\x13transmit_successful\x18\n \x01(\x08\x12U\n\x0cmodem_config\x18\x14 \x01(\x0e\x32/.jaiabot.protobuf.LoRaMessage.ModemConfigChoice:\x0e\x42w125Cr45Sf128\x12\x14\n\x08tx_power\x18\x15 \x01(\x05:\x02\x31\x33\x12>\n\x07\x63ontrol\x18\x1e \x01(\x0b\x32-.jaiabot.protobuf.LoRaMessage.ControlSurfaces\x1a^\n\x0f\x43ontrolSurfaces\x12\r\n\x05motor\x18\x01 \x02(\x11\x12\x15\n\rport_elevator\x18\x02 \x02(\x11\x12\x15\n\rstbd_elevator\x18\x03 \x02(\x11\x12\x0e\n\x06rudder\x18\x04 \x02(\x11\"\xae\x01\n\x0bMessageType\x12\r\n\tLORA_DATA\x10\x01\x12\x12\n\x0eSET_PARAMETERS\x10\x02\x12\x17\n\x13PARAMETERS_ACCEPTED\x10\x03\x12\x17\n\x13PARAMETERS_REJECTED\x10\x04\x12\x11\n\rFEATHER_READY\x10\x05\x12\x13\n\x0fTRANSMIT_RESULT\x10\x06\x12\x0f\n\x0bLOW_CONTROL\x10\x32\x12\x11\n\rDEBUG_MESSAGE\x10\x64\"{\n\x11ModemConfigChoice\x12\x12\n\x0e\x42w125Cr45Sf128\x10\x01\x12\x12\n\x0e\x42w500Cr45Sf128\x10\x02\x12\x14\n\x10\x42w31_25Cr48Sf512\x10\x03\x12\x13\n\x0f\x42w125Cr48Sf4096\x10\x04\x12\x13\n\x0f\x42w125Cr45Sf2048\x10\x05')
)



_LORAMESSAGE_MESSAGETYPE = _descriptor.EnumDescriptor(
  name='MessageType',
  full_name='jaiabot.protobuf.LoRaMessage.MessageType',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='LORA_DATA', index=0, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='SET_PARAMETERS', index=1, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='PARAMETERS_ACCEPTED', index=2, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='PARAMETERS_REJECTED', index=3, number=4,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='FEATHER_READY', index=4, number=5,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='TRANSMIT_RESULT', index=5, number=6,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='LOW_CONTROL', index=6, number=50,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='DEBUG_MESSAGE', index=7, number=100,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=517,
  serialized_end=691,
)
_sym_db.RegisterEnumDescriptor(_LORAMESSAGE_MESSAGETYPE)

_LORAMESSAGE_MODEMCONFIGCHOICE = _descriptor.EnumDescriptor(
  name='ModemConfigChoice',
  full_name='jaiabot.protobuf.LoRaMessage.ModemConfigChoice',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='Bw125Cr45Sf128', index=0, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='Bw500Cr45Sf128', index=1, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='Bw31_25Cr48Sf512', index=2, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='Bw125Cr48Sf4096', index=3, number=4,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='Bw125Cr45Sf2048', index=4, number=5,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=693,
  serialized_end=816,
)
_sym_db.RegisterEnumDescriptor(_LORAMESSAGE_MODEMCONFIGCHOICE)


_LORAMESSAGE_CONTROLSURFACES = _descriptor.Descriptor(
  name='ControlSurfaces',
  full_name='jaiabot.protobuf.LoRaMessage.ControlSurfaces',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='motor', full_name='jaiabot.protobuf.LoRaMessage.ControlSurfaces.motor', index=0,
      number=1, type=17, cpp_type=1, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='port_elevator', full_name='jaiabot.protobuf.LoRaMessage.ControlSurfaces.port_elevator', index=1,
      number=2, type=17, cpp_type=1, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='stbd_elevator', full_name='jaiabot.protobuf.LoRaMessage.ControlSurfaces.stbd_elevator', index=2,
      number=3, type=17, cpp_type=1, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='rudder', full_name='jaiabot.protobuf.LoRaMessage.ControlSurfaces.rudder', index=3,
      number=4, type=17, cpp_type=1, label=2,
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
  serialized_start=420,
  serialized_end=514,
)

_LORAMESSAGE = _descriptor.Descriptor(
  name='LoRaMessage',
  full_name='jaiabot.protobuf.LoRaMessage',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='src', full_name='jaiabot.protobuf.LoRaMessage.src', index=0,
      number=1, type=5, cpp_type=1, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='dest', full_name='jaiabot.protobuf.LoRaMessage.dest', index=1,
      number=2, type=5, cpp_type=1, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='data', full_name='jaiabot.protobuf.LoRaMessage.data', index=2,
      number=3, type=12, cpp_type=9, label=1,
      has_default_value=False, default_value=_b(""),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='type', full_name='jaiabot.protobuf.LoRaMessage.type', index=3,
      number=4, type=14, cpp_type=8, label=2,
      has_default_value=True, default_value=1,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='id', full_name='jaiabot.protobuf.LoRaMessage.id', index=4,
      number=5, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='flags', full_name='jaiabot.protobuf.LoRaMessage.flags', index=5,
      number=6, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='rssi', full_name='jaiabot.protobuf.LoRaMessage.rssi', index=6,
      number=7, type=17, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='transmit_successful', full_name='jaiabot.protobuf.LoRaMessage.transmit_successful', index=7,
      number=10, type=8, cpp_type=7, label=1,
      has_default_value=False, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='modem_config', full_name='jaiabot.protobuf.LoRaMessage.modem_config', index=8,
      number=20, type=14, cpp_type=8, label=1,
      has_default_value=True, default_value=1,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='tx_power', full_name='jaiabot.protobuf.LoRaMessage.tx_power', index=9,
      number=21, type=5, cpp_type=1, label=1,
      has_default_value=True, default_value=13,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='control', full_name='jaiabot.protobuf.LoRaMessage.control', index=10,
      number=30, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[_LORAMESSAGE_CONTROLSURFACES, ],
  enum_types=[
    _LORAMESSAGE_MESSAGETYPE,
    _LORAMESSAGE_MODEMCONFIGCHOICE,
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=53,
  serialized_end=816,
)

_LORAMESSAGE_CONTROLSURFACES.containing_type = _LORAMESSAGE
_LORAMESSAGE.fields_by_name['type'].enum_type = _LORAMESSAGE_MESSAGETYPE
_LORAMESSAGE.fields_by_name['modem_config'].enum_type = _LORAMESSAGE_MODEMCONFIGCHOICE
_LORAMESSAGE.fields_by_name['control'].message_type = _LORAMESSAGE_CONTROLSURFACES
_LORAMESSAGE_MESSAGETYPE.containing_type = _LORAMESSAGE
_LORAMESSAGE_MODEMCONFIGCHOICE.containing_type = _LORAMESSAGE
DESCRIPTOR.message_types_by_name['LoRaMessage'] = _LORAMESSAGE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

LoRaMessage = _reflection.GeneratedProtocolMessageType('LoRaMessage', (_message.Message,), dict(

  ControlSurfaces = _reflection.GeneratedProtocolMessageType('ControlSurfaces', (_message.Message,), dict(
    DESCRIPTOR = _LORAMESSAGE_CONTROLSURFACES,
    __module__ = 'jaiabot.messages.feather_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.LoRaMessage.ControlSurfaces)
    ))
  ,
  DESCRIPTOR = _LORAMESSAGE,
  __module__ = 'jaiabot.messages.feather_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.LoRaMessage)
  ))
_sym_db.RegisterMessage(LoRaMessage)
_sym_db.RegisterMessage(LoRaMessage.ControlSurfaces)


# @@protoc_insertion_point(module_scope)