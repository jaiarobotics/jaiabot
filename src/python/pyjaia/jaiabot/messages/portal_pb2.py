# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/portal.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2
from jaiabot.messages import engineering_pb2 as jaiabot_dot_messages_dot_engineering__pb2
from jaiabot.messages import hub_pb2 as jaiabot_dot_messages_dot_hub__pb2
from jaiabot.messages import jaia_dccl_pb2 as jaiabot_dot_messages_dot_jaia__dccl__pb2
from jaiabot.messages import metadata_pb2 as jaiabot_dot_messages_dot_metadata__pb2
from jaiabot.messages import mission_pb2 as jaiabot_dot_messages_dot_mission__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/portal.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\x1djaiabot/messages/portal.proto\x12\x10jaiabot.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\x1a\"jaiabot/messages/engineering.proto\x1a\x1ajaiabot/messages/hub.proto\x1a jaiabot/messages/jaia_dccl.proto\x1a\x1fjaiabot/messages/metadata.proto\x1a\x1ejaiabot/messages/mission.proto\"\xd1\x01\n\x15\x43lientToPortalMessage\x12:\n\x13\x65ngineering_command\x18\x01 \x01(\x0b\x32\x1d.jaiabot.protobuf.Engineering\x12*\n\x07\x63ommand\x18\x02 \x01(\x0b\x32\x19.jaiabot.protobuf.Command\x12\x38\n\x0f\x63ommand_for_hub\x18\x03 \x01(\x0b\x32\x1f.jaiabot.protobuf.CommandForHub\x12\x0c\n\x04ping\x18\x04 \x01(\x08:\x08\xa2?\x05\xf2\x01\x02si\"\xe8\x02\n\x15PortalToClientMessage\x12/\n\nbot_status\x18\x01 \x01(\x0b\x32\x1b.jaiabot.protobuf.BotStatus\x12\x39\n\x12\x65ngineering_status\x18\x02 \x01(\x0b\x32\x1d.jaiabot.protobuf.Engineering\x12/\n\nhub_status\x18\x03 \x01(\x0b\x32\x1b.jaiabot.protobuf.HubStatus\x12\x31\n\x0btask_packet\x18\x04 \x01(\x0b\x32\x1c.jaiabot.protobuf.TaskPacket\x12\x39\n\x0f\x64\x65vice_metadata\x18\x05 \x01(\x0b\x32 .jaiabot.protobuf.DeviceMetadata\x12:\n\x13\x61\x63tive_mission_plan\x18\x06 \x01(\x0b\x32\x1d.jaiabot.protobuf.MissionPlan:\x08\xa2?\x05\xf2\x01\x02si')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_engineering__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_hub__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_jaia__dccl__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_metadata__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_mission__pb2.DESCRIPTOR,])




_CLIENTTOPORTALMESSAGE = _descriptor.Descriptor(
  name='ClientToPortalMessage',
  full_name='jaiabot.protobuf.ClientToPortalMessage',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='engineering_command', full_name='jaiabot.protobuf.ClientToPortalMessage.engineering_command', index=0,
      number=1, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='command', full_name='jaiabot.protobuf.ClientToPortalMessage.command', index=1,
      number=2, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='command_for_hub', full_name='jaiabot.protobuf.ClientToPortalMessage.command_for_hub', index=2,
      number=3, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='ping', full_name='jaiabot.protobuf.ClientToPortalMessage.ping', index=3,
      number=4, type=8, cpp_type=7, label=1,
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
  ],
  serialized_start=245,
  serialized_end=454,
)


_PORTALTOCLIENTMESSAGE = _descriptor.Descriptor(
  name='PortalToClientMessage',
  full_name='jaiabot.protobuf.PortalToClientMessage',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='bot_status', full_name='jaiabot.protobuf.PortalToClientMessage.bot_status', index=0,
      number=1, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='engineering_status', full_name='jaiabot.protobuf.PortalToClientMessage.engineering_status', index=1,
      number=2, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='hub_status', full_name='jaiabot.protobuf.PortalToClientMessage.hub_status', index=2,
      number=3, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='task_packet', full_name='jaiabot.protobuf.PortalToClientMessage.task_packet', index=3,
      number=4, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='device_metadata', full_name='jaiabot.protobuf.PortalToClientMessage.device_metadata', index=4,
      number=5, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='active_mission_plan', full_name='jaiabot.protobuf.PortalToClientMessage.active_mission_plan', index=5,
      number=6, type=11, cpp_type=10, label=1,
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
  serialized_start=457,
  serialized_end=817,
)

_CLIENTTOPORTALMESSAGE.fields_by_name['engineering_command'].message_type = jaiabot_dot_messages_dot_engineering__pb2._ENGINEERING
_CLIENTTOPORTALMESSAGE.fields_by_name['command'].message_type = jaiabot_dot_messages_dot_jaia__dccl__pb2._COMMAND
_CLIENTTOPORTALMESSAGE.fields_by_name['command_for_hub'].message_type = jaiabot_dot_messages_dot_jaia__dccl__pb2._COMMANDFORHUB
_PORTALTOCLIENTMESSAGE.fields_by_name['bot_status'].message_type = jaiabot_dot_messages_dot_jaia__dccl__pb2._BOTSTATUS
_PORTALTOCLIENTMESSAGE.fields_by_name['engineering_status'].message_type = jaiabot_dot_messages_dot_engineering__pb2._ENGINEERING
_PORTALTOCLIENTMESSAGE.fields_by_name['hub_status'].message_type = jaiabot_dot_messages_dot_hub__pb2._HUBSTATUS
_PORTALTOCLIENTMESSAGE.fields_by_name['task_packet'].message_type = jaiabot_dot_messages_dot_jaia__dccl__pb2._TASKPACKET
_PORTALTOCLIENTMESSAGE.fields_by_name['device_metadata'].message_type = jaiabot_dot_messages_dot_metadata__pb2._DEVICEMETADATA
_PORTALTOCLIENTMESSAGE.fields_by_name['active_mission_plan'].message_type = jaiabot_dot_messages_dot_mission__pb2._MISSIONPLAN
DESCRIPTOR.message_types_by_name['ClientToPortalMessage'] = _CLIENTTOPORTALMESSAGE
DESCRIPTOR.message_types_by_name['PortalToClientMessage'] = _PORTALTOCLIENTMESSAGE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

ClientToPortalMessage = _reflection.GeneratedProtocolMessageType('ClientToPortalMessage', (_message.Message,), dict(
  DESCRIPTOR = _CLIENTTOPORTALMESSAGE,
  __module__ = 'jaiabot.messages.portal_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.ClientToPortalMessage)
  ))
_sym_db.RegisterMessage(ClientToPortalMessage)

PortalToClientMessage = _reflection.GeneratedProtocolMessageType('PortalToClientMessage', (_message.Message,), dict(
  DESCRIPTOR = _PORTALTOCLIENTMESSAGE,
  __module__ = 'jaiabot.messages.portal_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.PortalToClientMessage)
  ))
_sym_db.RegisterMessage(PortalToClientMessage)


_CLIENTTOPORTALMESSAGE._options = None
_PORTALTOCLIENTMESSAGE._options = None
# @@protoc_insertion_point(module_scope)