# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/engineering.proto

import sys
_b=sys.version_info[0]<3 and (lambda x:x) or (lambda x:x.encode('latin1'))
from google.protobuf.internal import enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from google.protobuf import reflection as _reflection
from google.protobuf import symbol_database as _symbol_database
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from dccl import option_extensions_pb2 as dccl_dot_option__extensions__pb2
from jaiabot.messages import bounds_pb2 as jaiabot_dot_messages_dot_bounds__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/engineering.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\"jaiabot/messages/engineering.proto\x12\x10jaiabot.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\x1a\x1djaiabot/messages/bounds.proto\"\xbd\x06\n\nPIDControl\x12\x31\n\x07timeout\x18\x03 \x01(\rB \xa2?\x1d \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00Y@\xf2\x01\x06\x12\x04time\x12)\n\x08throttle\x18\x04 \x01(\x01\x42\x17\xa2?\x14 \x00)\x00\x00\x00\x00\x00\x00Y\xc0\x31\x00\x00\x00\x00\x00\x00Y@\x12\x37\n\x05speed\x18\x05 \x01(\x0b\x32(.jaiabot.protobuf.PIDControl.PIDSettings\x12\'\n\x06rudder\x18\x06 \x01(\x01\x42\x17\xa2?\x14 \x00)\x00\x00\x00\x00\x00\x00Y\xc0\x31\x00\x00\x00\x00\x00\x00Y@\x12\x39\n\x07heading\x18\x07 \x01(\x0b\x32(.jaiabot.protobuf.PIDControl.PIDSettings\x12.\n\rport_elevator\x18\x08 \x01(\x01\x42\x17\xa2?\x14 \x00)\x00\x00\x00\x00\x00\x00Y\xc0\x31\x00\x00\x00\x00\x00\x00Y@\x12.\n\rstbd_elevator\x18\t \x01(\x01\x42\x17\xa2?\x14 \x00)\x00\x00\x00\x00\x00\x00Y\xc0\x31\x00\x00\x00\x00\x00\x00Y@\x12\x36\n\x04roll\x18\n \x01(\x0b\x32(.jaiabot.protobuf.PIDControl.PIDSettings\x12\x37\n\x05pitch\x18\x0b \x01(\x0b\x32(.jaiabot.protobuf.PIDControl.PIDSettings\x12\x37\n\x05\x64\x65pth\x18\x0c \x01(\x0b\x32(.jaiabot.protobuf.PIDControl.PIDSettings\x12\x15\n\rled_switch_on\x18\r \x01(\x08\x12\x42\n\x10heading_constant\x18\x0e \x01(\x0b\x32(.jaiabot.protobuf.PIDControl.PIDSettings\x1a\xc4\x01\n\x0bPIDSettings\x12\x46\n\x06target\x18\x01 \x01(\x01\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x80v\xc0\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12#\n\x02Kp\x18\x02 \x01(\x01\x42\x17\xa2?\x14 \x08)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00Y@\x12#\n\x02Ki\x18\x03 \x01(\x01\x42\x17\xa2?\x14 \x08)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00Y@\x12#\n\x02Kd\x18\x04 \x01(\x01\x42\x17\xa2?\x14 \x08)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00Y@:\x08\xa2?\x05\xf2\x01\x02si\"\x9e\x03\n\x0fGPSRequirements\x12\x31\n\x10transit_hdop_req\x18\x01 \x01(\x01\x42\x17\xa2?\x14 \x02)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@\x12\x31\n\x10transit_pdop_req\x18\x02 \x01(\x01\x42\x17\xa2?\x14 \x02)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@\x12\x34\n\x13\x61\x66ter_dive_hdop_req\x18\x03 \x01(\x01\x42\x17\xa2?\x14 \x02)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@\x12\x34\n\x13\x61\x66ter_dive_pdop_req\x18\x04 \x01(\x01\x42\x17\xa2?\x14 \x02)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@\x12\x35\n\x16transit_gps_fix_checks\x18\x05 \x01(\rB\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@\x12>\n\x1ftransit_gps_degraded_fix_checks\x18\x06 \x01(\rB\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@\x12\x38\n\x19\x61\x66ter_dive_gps_fix_checks\x18\x07 \x01(\rB\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\x00Y@:\x08\xa2?\x05\xf2\x01\x02si\"i\n\x10RFDisableOptions\x12\x19\n\nrf_disable\x18\x01 \x01(\x08:\x05\x66\x61lse\x12:\n\x17rf_disable_timeout_mins\x18\x02 \x01(\x05:\x02\x31\x30\x42\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\xf0?1\x00\x00\x00\x00\x00\xe0o@\"\xbc\x02\n\x17\x42ottomDepthSafetyParams\x12S\n\x10\x63onstant_heading\x18\x01 \x01(\x01:\x01\x30\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12?\n\x15\x63onstant_heading_time\x18\x02 \x01(\x05:\x01\x30\x42\x1d\xa2?\x1a \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x03\n\x01T\x12\x44\n\x16\x63onstant_heading_speed\x18\x03 \x01(\x01:\x01\x32\x42!\xa2?\x1e \x01)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00\x08@\xf2\x01\x07\n\x05LT^-1\x12;\n\x0csafety_depth\x18\x04 \x01(\x01:\x02-1B!\xa2?\x1e \x01)\x00\x00\x00\x00\x00\x00\xf0\xbf\x31\x00\x00\x00\x00\x00\x00N@\xf2\x01\x07\n\x05LT^-1:\x08\xa2?\x05\xf2\x01\x02si\"2\n\x0eIMUCalibration\x12\x16\n\x07run_cal\x18\x01 \x01(\x08:\x05\x66\x61lse:\x08\xa2?\x05\xf2\x01\x02si\"\xb3\x05\n\x0b\x45ngineering\x12%\n\x06\x62ot_id\x18\x01 \x02(\rB\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\xe0o@\x12-\n\x04time\x18\x02 \x01(\x04\x42\x1f\xa2?\x1c\n\ndccl.time2\xf2\x01\r\x12\x04time2\x05micro\x12\x31\n\x0bpid_control\x18\x03 \x01(\x0b\x32\x1c.jaiabot.protobuf.PIDControl\x12\'\n\x18query_engineering_status\x18\x04 \x01(\x08:\x05\x66\x61lse\x12\x1f\n\x10query_bot_status\x18\x05 \x01(\x08:\x05\x66\x61lse\x12$\n\x1c\x65ngineering_messages_enabled\x18\r \x01(\x08\x12L\n\x0f\x62ot_status_rate\x18\x0e \x01(\x0e\x32\x1f.jaiabot.protobuf.BotStatusRate:\x12\x42otStatusRate_1_Hz\x12;\n\x10gps_requirements\x18\x0f \x01(\x0b\x32!.jaiabot.protobuf.GPSRequirements\x12>\n\x12rf_disable_options\x18\x10 \x01(\x0b\x32\".jaiabot.protobuf.RFDisableOptions\x12M\n\x1a\x62ottom_depth_safety_params\x18\x11 \x01(\x0b\x32).jaiabot.protobuf.BottomDepthSafetyParams\x12\x31\n\x07imu_cal\x18\x12 \x01(\x0b\x32 .jaiabot.protobuf.IMUCalibration\x12#\n\x04\x66lag\x18\x64 \x01(\rB\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00\x90@\x12(\n\x06\x62ounds\x18\x65 \x01(\x0b\x32\x18.jaiabot.protobuf.Bounds:\x0f\xa2?\x0c\x08\x7f\x10\xfa\x01(\x04\xf2\x01\x02si*\x8a\x02\n\rBotStatusRate\x12\x16\n\x12\x42otStatusRate_2_Hz\x10\x00\x12\x16\n\x12\x42otStatusRate_1_Hz\x10\x01\x12\x1b\n\x17\x42otStatusRate_2_SECONDS\x10\x02\x12\x1b\n\x17\x42otStatusRate_5_SECONDS\x10\x03\x12\x1c\n\x18\x42otStatusRate_10_SECONDS\x10\x04\x12\x1c\n\x18\x42otStatusRate_20_SECONDS\x10\x05\x12\x1c\n\x18\x42otStatusRate_40_SECONDS\x10\x06\x12\x1c\n\x18\x42otStatusRate_60_SECONDS\x10\x07\x12\x17\n\x13\x42otStatusRate_NO_RF\x10\x08')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_bounds__pb2.DESCRIPTOR,])

_BOTSTATUSRATE = _descriptor.EnumDescriptor(
  name='BotStatusRate',
  full_name='jaiabot.protobuf.BotStatusRate',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_2_Hz', index=0, number=0,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_1_Hz', index=1, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_2_SECONDS', index=2, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_5_SECONDS', index=3, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_10_SECONDS', index=4, number=4,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_20_SECONDS', index=5, number=5,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_40_SECONDS', index=6, number=6,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_60_SECONDS', index=7, number=7,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='BotStatusRate_NO_RF', index=8, number=8,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=2539,
  serialized_end=2805,
)
_sym_db.RegisterEnumDescriptor(_BOTSTATUSRATE)

BotStatusRate = enum_type_wrapper.EnumTypeWrapper(_BOTSTATUSRATE)
BotStatusRate_2_Hz = 0
BotStatusRate_1_Hz = 1
BotStatusRate_2_SECONDS = 2
BotStatusRate_5_SECONDS = 3
BotStatusRate_10_SECONDS = 4
BotStatusRate_20_SECONDS = 5
BotStatusRate_40_SECONDS = 6
BotStatusRate_60_SECONDS = 7
BotStatusRate_NO_RF = 8



_PIDCONTROL_PIDSETTINGS = _descriptor.Descriptor(
  name='PIDSettings',
  full_name='jaiabot.protobuf.PIDControl.PIDSettings',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='target', full_name='jaiabot.protobuf.PIDControl.PIDSettings.target', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\200v\3001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='Kp', full_name='jaiabot.protobuf.PIDControl.PIDSettings.Kp', index=1,
      number=2, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \010)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='Ki', full_name='jaiabot.protobuf.PIDControl.PIDSettings.Ki', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \010)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='Kd', full_name='jaiabot.protobuf.PIDControl.PIDSettings.Kd', index=3,
      number=4, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \010)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
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
  serialized_start=741,
  serialized_end=937,
)

_PIDCONTROL = _descriptor.Descriptor(
  name='PIDControl',
  full_name='jaiabot.protobuf.PIDControl',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='timeout', full_name='jaiabot.protobuf.PIDControl.timeout', index=0,
      number=3, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\035 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000Y@\362\001\006\022\004time'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='throttle', full_name='jaiabot.protobuf.PIDControl.throttle', index=1,
      number=4, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \000)\000\000\000\000\000\000Y\3001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='speed', full_name='jaiabot.protobuf.PIDControl.speed', index=2,
      number=5, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='rudder', full_name='jaiabot.protobuf.PIDControl.rudder', index=3,
      number=6, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \000)\000\000\000\000\000\000Y\3001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='heading', full_name='jaiabot.protobuf.PIDControl.heading', index=4,
      number=7, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='port_elevator', full_name='jaiabot.protobuf.PIDControl.port_elevator', index=5,
      number=8, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \000)\000\000\000\000\000\000Y\3001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='stbd_elevator', full_name='jaiabot.protobuf.PIDControl.stbd_elevator', index=6,
      number=9, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \000)\000\000\000\000\000\000Y\3001\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='roll', full_name='jaiabot.protobuf.PIDControl.roll', index=7,
      number=10, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='pitch', full_name='jaiabot.protobuf.PIDControl.pitch', index=8,
      number=11, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='depth', full_name='jaiabot.protobuf.PIDControl.depth', index=9,
      number=12, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='led_switch_on', full_name='jaiabot.protobuf.PIDControl.led_switch_on', index=10,
      number=13, type=8, cpp_type=7, label=1,
      has_default_value=False, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='heading_constant', full_name='jaiabot.protobuf.PIDControl.heading_constant', index=11,
      number=14, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[_PIDCONTROL_PIDSETTINGS, ],
  enum_types=[
  ],
  serialized_options=_b('\242?\005\362\001\002si'),
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=118,
  serialized_end=947,
)


_GPSREQUIREMENTS = _descriptor.Descriptor(
  name='GPSRequirements',
  full_name='jaiabot.protobuf.GPSRequirements',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='transit_hdop_req', full_name='jaiabot.protobuf.GPSRequirements.transit_hdop_req', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \002)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='transit_pdop_req', full_name='jaiabot.protobuf.GPSRequirements.transit_pdop_req', index=1,
      number=2, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \002)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='after_dive_hdop_req', full_name='jaiabot.protobuf.GPSRequirements.after_dive_hdop_req', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \002)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='after_dive_pdop_req', full_name='jaiabot.protobuf.GPSRequirements.after_dive_pdop_req', index=3,
      number=4, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\024 \002)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='transit_gps_fix_checks', full_name='jaiabot.protobuf.GPSRequirements.transit_gps_fix_checks', index=4,
      number=5, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='transit_gps_degraded_fix_checks', full_name='jaiabot.protobuf.GPSRequirements.transit_gps_degraded_fix_checks', index=5,
      number=6, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='after_dive_gps_fix_checks', full_name='jaiabot.protobuf.GPSRequirements.after_dive_gps_fix_checks', index=6,
      number=7, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\360?1\000\000\000\000\000\000Y@'), file=DESCRIPTOR),
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
  serialized_start=950,
  serialized_end=1364,
)


_RFDISABLEOPTIONS = _descriptor.Descriptor(
  name='RFDisableOptions',
  full_name='jaiabot.protobuf.RFDisableOptions',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='rf_disable', full_name='jaiabot.protobuf.RFDisableOptions.rf_disable', index=0,
      number=1, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='rf_disable_timeout_mins', full_name='jaiabot.protobuf.RFDisableOptions.rf_disable_timeout_mins', index=1,
      number=2, type=5, cpp_type=1, label=1,
      has_default_value=True, default_value=10,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\360?1\000\000\000\000\000\340o@'), file=DESCRIPTOR),
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
  serialized_start=1366,
  serialized_end=1471,
)


_BOTTOMDEPTHSAFETYPARAMS = _descriptor.Descriptor(
  name='BottomDepthSafetyParams',
  full_name='jaiabot.protobuf.BottomDepthSafetyParams',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='constant_heading', full_name='jaiabot.protobuf.BottomDepthSafetyParams.constant_heading', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='constant_heading_time', full_name='jaiabot.protobuf.BottomDepthSafetyParams.constant_heading_time', index=1,
      number=2, type=5, cpp_type=1, label=1,
      has_default_value=True, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\032 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\003\n\001T'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='constant_heading_speed', full_name='jaiabot.protobuf.BottomDepthSafetyParams.constant_heading_speed', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(2),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\036 \001)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000\010@\362\001\007\n\005LT^-1'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='safety_depth', full_name='jaiabot.protobuf.BottomDepthSafetyParams.safety_depth', index=3,
      number=4, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(-1),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\036 \001)\000\000\000\000\000\000\360\2771\000\000\000\000\000\000N@\362\001\007\n\005LT^-1'), file=DESCRIPTOR),
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
  serialized_start=1474,
  serialized_end=1790,
)


_IMUCALIBRATION = _descriptor.Descriptor(
  name='IMUCalibration',
  full_name='jaiabot.protobuf.IMUCalibration',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='run_cal', full_name='jaiabot.protobuf.IMUCalibration.run_cal', index=0,
      number=1, type=8, cpp_type=7, label=1,
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
  serialized_start=1792,
  serialized_end=1842,
)


_ENGINEERING = _descriptor.Descriptor(
  name='Engineering',
  full_name='jaiabot.protobuf.Engineering',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='bot_id', full_name='jaiabot.protobuf.Engineering.bot_id', index=0,
      number=1, type=13, cpp_type=3, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\000\0001\000\000\000\000\000\340o@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='time', full_name='jaiabot.protobuf.Engineering.time', index=1,
      number=2, type=4, cpp_type=4, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\034\n\ndccl.time2\362\001\r\022\004time2\005micro'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='pid_control', full_name='jaiabot.protobuf.Engineering.pid_control', index=2,
      number=3, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='query_engineering_status', full_name='jaiabot.protobuf.Engineering.query_engineering_status', index=3,
      number=4, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='query_bot_status', full_name='jaiabot.protobuf.Engineering.query_bot_status', index=4,
      number=5, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='engineering_messages_enabled', full_name='jaiabot.protobuf.Engineering.engineering_messages_enabled', index=5,
      number=13, type=8, cpp_type=7, label=1,
      has_default_value=False, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='bot_status_rate', full_name='jaiabot.protobuf.Engineering.bot_status_rate', index=6,
      number=14, type=14, cpp_type=8, label=1,
      has_default_value=True, default_value=1,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='gps_requirements', full_name='jaiabot.protobuf.Engineering.gps_requirements', index=7,
      number=15, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='rf_disable_options', full_name='jaiabot.protobuf.Engineering.rf_disable_options', index=8,
      number=16, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='bottom_depth_safety_params', full_name='jaiabot.protobuf.Engineering.bottom_depth_safety_params', index=9,
      number=17, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='imu_cal', full_name='jaiabot.protobuf.Engineering.imu_cal', index=10,
      number=18, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='flag', full_name='jaiabot.protobuf.Engineering.flag', index=11,
      number=100, type=13, cpp_type=3, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000\220@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='bounds', full_name='jaiabot.protobuf.Engineering.bounds', index=12,
      number=101, type=11, cpp_type=10, label=1,
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
  serialized_options=_b('\242?\014\010\177\020\372\001(\004\362\001\002si'),
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=1845,
  serialized_end=2536,
)

_PIDCONTROL_PIDSETTINGS.containing_type = _PIDCONTROL
_PIDCONTROL.fields_by_name['speed'].message_type = _PIDCONTROL_PIDSETTINGS
_PIDCONTROL.fields_by_name['heading'].message_type = _PIDCONTROL_PIDSETTINGS
_PIDCONTROL.fields_by_name['roll'].message_type = _PIDCONTROL_PIDSETTINGS
_PIDCONTROL.fields_by_name['pitch'].message_type = _PIDCONTROL_PIDSETTINGS
_PIDCONTROL.fields_by_name['depth'].message_type = _PIDCONTROL_PIDSETTINGS
_PIDCONTROL.fields_by_name['heading_constant'].message_type = _PIDCONTROL_PIDSETTINGS
_ENGINEERING.fields_by_name['pid_control'].message_type = _PIDCONTROL
_ENGINEERING.fields_by_name['bot_status_rate'].enum_type = _BOTSTATUSRATE
_ENGINEERING.fields_by_name['gps_requirements'].message_type = _GPSREQUIREMENTS
_ENGINEERING.fields_by_name['rf_disable_options'].message_type = _RFDISABLEOPTIONS
_ENGINEERING.fields_by_name['bottom_depth_safety_params'].message_type = _BOTTOMDEPTHSAFETYPARAMS
_ENGINEERING.fields_by_name['imu_cal'].message_type = _IMUCALIBRATION
_ENGINEERING.fields_by_name['bounds'].message_type = jaiabot_dot_messages_dot_bounds__pb2._BOUNDS
DESCRIPTOR.message_types_by_name['PIDControl'] = _PIDCONTROL
DESCRIPTOR.message_types_by_name['GPSRequirements'] = _GPSREQUIREMENTS
DESCRIPTOR.message_types_by_name['RFDisableOptions'] = _RFDISABLEOPTIONS
DESCRIPTOR.message_types_by_name['BottomDepthSafetyParams'] = _BOTTOMDEPTHSAFETYPARAMS
DESCRIPTOR.message_types_by_name['IMUCalibration'] = _IMUCALIBRATION
DESCRIPTOR.message_types_by_name['Engineering'] = _ENGINEERING
DESCRIPTOR.enum_types_by_name['BotStatusRate'] = _BOTSTATUSRATE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

PIDControl = _reflection.GeneratedProtocolMessageType('PIDControl', (_message.Message,), dict(

  PIDSettings = _reflection.GeneratedProtocolMessageType('PIDSettings', (_message.Message,), dict(
    DESCRIPTOR = _PIDCONTROL_PIDSETTINGS,
    __module__ = 'jaiabot.messages.engineering_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.PIDControl.PIDSettings)
    ))
  ,
  DESCRIPTOR = _PIDCONTROL,
  __module__ = 'jaiabot.messages.engineering_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.PIDControl)
  ))
_sym_db.RegisterMessage(PIDControl)
_sym_db.RegisterMessage(PIDControl.PIDSettings)

GPSRequirements = _reflection.GeneratedProtocolMessageType('GPSRequirements', (_message.Message,), dict(
  DESCRIPTOR = _GPSREQUIREMENTS,
  __module__ = 'jaiabot.messages.engineering_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.GPSRequirements)
  ))
_sym_db.RegisterMessage(GPSRequirements)

RFDisableOptions = _reflection.GeneratedProtocolMessageType('RFDisableOptions', (_message.Message,), dict(
  DESCRIPTOR = _RFDISABLEOPTIONS,
  __module__ = 'jaiabot.messages.engineering_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.RFDisableOptions)
  ))
_sym_db.RegisterMessage(RFDisableOptions)

BottomDepthSafetyParams = _reflection.GeneratedProtocolMessageType('BottomDepthSafetyParams', (_message.Message,), dict(
  DESCRIPTOR = _BOTTOMDEPTHSAFETYPARAMS,
  __module__ = 'jaiabot.messages.engineering_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.BottomDepthSafetyParams)
  ))
_sym_db.RegisterMessage(BottomDepthSafetyParams)

IMUCalibration = _reflection.GeneratedProtocolMessageType('IMUCalibration', (_message.Message,), dict(
  DESCRIPTOR = _IMUCALIBRATION,
  __module__ = 'jaiabot.messages.engineering_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUCalibration)
  ))
_sym_db.RegisterMessage(IMUCalibration)

Engineering = _reflection.GeneratedProtocolMessageType('Engineering', (_message.Message,), dict(
  DESCRIPTOR = _ENGINEERING,
  __module__ = 'jaiabot.messages.engineering_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.Engineering)
  ))
_sym_db.RegisterMessage(Engineering)


_PIDCONTROL_PIDSETTINGS.fields_by_name['target']._options = None
_PIDCONTROL_PIDSETTINGS.fields_by_name['Kp']._options = None
_PIDCONTROL_PIDSETTINGS.fields_by_name['Ki']._options = None
_PIDCONTROL_PIDSETTINGS.fields_by_name['Kd']._options = None
_PIDCONTROL.fields_by_name['timeout']._options = None
_PIDCONTROL.fields_by_name['throttle']._options = None
_PIDCONTROL.fields_by_name['rudder']._options = None
_PIDCONTROL.fields_by_name['port_elevator']._options = None
_PIDCONTROL.fields_by_name['stbd_elevator']._options = None
_PIDCONTROL._options = None
_GPSREQUIREMENTS.fields_by_name['transit_hdop_req']._options = None
_GPSREQUIREMENTS.fields_by_name['transit_pdop_req']._options = None
_GPSREQUIREMENTS.fields_by_name['after_dive_hdop_req']._options = None
_GPSREQUIREMENTS.fields_by_name['after_dive_pdop_req']._options = None
_GPSREQUIREMENTS.fields_by_name['transit_gps_fix_checks']._options = None
_GPSREQUIREMENTS.fields_by_name['transit_gps_degraded_fix_checks']._options = None
_GPSREQUIREMENTS.fields_by_name['after_dive_gps_fix_checks']._options = None
_GPSREQUIREMENTS._options = None
_RFDISABLEOPTIONS.fields_by_name['rf_disable_timeout_mins']._options = None
_BOTTOMDEPTHSAFETYPARAMS.fields_by_name['constant_heading']._options = None
_BOTTOMDEPTHSAFETYPARAMS.fields_by_name['constant_heading_time']._options = None
_BOTTOMDEPTHSAFETYPARAMS.fields_by_name['constant_heading_speed']._options = None
_BOTTOMDEPTHSAFETYPARAMS.fields_by_name['safety_depth']._options = None
_BOTTOMDEPTHSAFETYPARAMS._options = None
_IMUCALIBRATION._options = None
_ENGINEERING.fields_by_name['bot_id']._options = None
_ENGINEERING.fields_by_name['time']._options = None
_ENGINEERING.fields_by_name['flag']._options = None
_ENGINEERING._options = None
# @@protoc_insertion_point(module_scope)
