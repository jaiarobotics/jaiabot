# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: jaiabot/messages/imu.proto

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
from jaiabot.messages import mission_pb2 as jaiabot_dot_messages_dot_mission__pb2


DESCRIPTOR = _descriptor.FileDescriptor(
  name='jaiabot/messages/imu.proto',
  package='jaiabot.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n\x1ajaiabot/messages/imu.proto\x12\x10jaiabot.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\x1a\x1ejaiabot/messages/mission.proto\"\x81\x02\n\nIMUCommand\x12\x39\n\x04type\x18\x01 \x02(\x0e\x32+.jaiabot.protobuf.IMUCommand.IMUCommandType\"\xb7\x01\n\x0eIMUCommandType\x12\x10\n\x0cTAKE_READING\x10\x00\x12\x1e\n\x1aSTART_WAVE_HEIGHT_SAMPLING\x10\x01\x12\x1d\n\x19STOP_WAVE_HEIGHT_SAMPLING\x10\x02\x12\x1e\n\x1aSTART_BOTTOM_TYPE_SAMPLING\x10\x03\x12\x1d\n\x19STOP_BOTTOM_TYPE_SAMPLING\x10\x04\x12\x15\n\x11START_CALIBRATION\x10\x05\"\x92\t\n\x07IMUData\x12;\n\x0c\x65uler_angles\x18\x01 \x01(\x0b\x32%.jaiabot.protobuf.IMUData.EulerAngles\x12\x43\n\x13linear_acceleration\x18\x02 \x01(\x0b\x32&.jaiabot.protobuf.IMUData.Acceleration\x12\x37\n\x07gravity\x18\x03 \x01(\x0b\x32&.jaiabot.protobuf.IMUData.Acceleration\x12\x38\n\naccuracies\x18\x04 \x01(\x0b\x32$.jaiabot.protobuf.IMUData.Accuracies\x12@\n\x11\x63\x61libration_state\x18\x05 \x01(\x0e\x32%.jaiabot.protobuf.IMUCalibrationState\x12\x1e\n\x0f\x62ot_rolled_over\x18\x06 \x01(\x08:\x05\x66\x61lse\x12\x33\n\x17significant_wave_height\x18\x07 \x01(\x01\x42\x12\xa2?\x0f\xf2\x01\x0c\x12\x06length\x1a\x02si\x12\x32\n\x10max_acceleration\x18\x08 \x01(\x01\x42\x18\xa2?\x15\xf2\x01\x12\x12\x0c\x61\x63\x63\x65leration\x1a\x02si\x12\x43\n\x10\x61ngular_velocity\x18\t \x01(\x0b\x32).jaiabot.protobuf.IMUData.AngularVelocity\x12\x38\n\nquaternion\x18\n \x01(\x0b\x32$.jaiabot.protobuf.IMUData.Quaternion\x12\x10\n\x08imu_type\x18\x0b \x01(\t\x1a\xa7\x01\n\x0b\x45ulerAngles\x12\x33\n\x07heading\x18\x01 \x01(\x01\x42\"\xa2?\x1f\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12\x31\n\x05pitch\x18\x02 \x01(\x01\x42\"\xa2?\x1f\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12\x30\n\x04roll\x18\x03 \x01(\x01\x42\"\xa2?\x1f\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x1a/\n\x0c\x41\x63\x63\x65leration\x12\t\n\x01x\x18\x01 \x01(\x01\x12\t\n\x01y\x18\x02 \x01(\x01\x12\t\n\x01z\x18\x03 \x01(\x01\x1a\x91\x01\n\nAccuracies\x12,\n\raccelerometer\x18\x01 \x01(\x05\x42\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00\x08@\x12(\n\tgyroscope\x18\x02 \x01(\x05\x42\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00\x08@\x12+\n\x0cmagnetometer\x18\x03 \x01(\x05\x42\x15\xa2?\x12)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x00\x08@\x1a\x8c\x01\n\x0f\x41ngularVelocity\x12\'\n\x01x\x18\x01 \x01(\x01\x42\x1c\xa2?\x19\xf2\x01\x16\x12\x10\x61ngular_velocity\x1a\x02si\x12\'\n\x01y\x18\x02 \x01(\x01\x42\x1c\xa2?\x19\xf2\x01\x16\x12\x10\x61ngular_velocity\x1a\x02si\x12\'\n\x01z\x18\x03 \x01(\x01\x42\x1c\xa2?\x19\xf2\x01\x16\x12\x10\x61ngular_velocity\x1a\x02si\x1a\x38\n\nQuaternion\x12\t\n\x01w\x18\x01 \x01(\x01\x12\t\n\x01x\x18\x02 \x01(\x01\x12\t\n\x01y\x18\x03 \x01(\x01\x12\t\n\x01z\x18\x04 \x01(\x01\"\xeb\x07\n\x08IMUIssue\x12\x39\n\x08solution\x18\x01 \x02(\x0e\x32\'.jaiabot.protobuf.IMUIssue.SolutionType\x12\x32\n\x04type\x18\x02 \x01(\x0e\x32$.jaiabot.protobuf.IMUIssue.IssueType\x12\x35\n\rmission_state\x18\x03 \x01(\x0e\x32\x1e.jaiabot.protobuf.MissionState\x12\'\n\x1bimu_heading_course_max_diff\x18\x1e \x01(\x01:\x02\x34\x35\x12G\n\x07heading\x18\x1f \x01(\x01\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12O\n\x0f\x64\x65sired_heading\x18  \x01(\x01\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12R\n\x12\x63ourse_over_ground\x18! \x01(\x01\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12Y\n\x19heading_course_difference\x18\" \x01(\x01\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x00\x00\x00\x31\x00\x00\x00\x00\x00\x80v@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12\x45\n\x05pitch\x18# \x01(\x01\x42\x36\xa2?3 \x00)\x00\x00\x00\x00\x00\x80\x66\xc0\x31\x00\x00\x00\x00\x00\x80\x66@\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12\x43\n\x11speed_over_ground\x18$ \x01(\x01\x42(\xa2?% \x01)\x00\x00\x00\x00\x00\x00\x14\xc0\x31\x00\x00\x00\x00\x00\x00$@\xf2\x01\x0e\x12\x08velocity\x1a\x02si\x12?\n\rdesired_speed\x18% \x01(\x01\x42(\xa2?% \x01)\x00\x00\x00\x00\x00\x00\x14\xc0\x31\x00\x00\x00\x00\x00\x00$@\xf2\x01\x0e\x12\x08velocity\x1a\x02si\"\xc3\x01\n\x0cSolutionType\x12\x0c\n\x08STOP_BOT\x10\x00\x12\x0b\n\x07USE_COG\x10\x01\x12\x12\n\x0eUSE_CORRECTION\x10\x02\x12\x0f\n\x0bRESTART_BOT\x10\x03\x12\x0e\n\nREBOOT_BOT\x10\x04\x12\x0e\n\nREPORT_IMU\x10\x05\x12\x12\n\x0eRESTART_IMU_PY\x10\x06\x12\x15\n\x11REBOOT_BNO085_IMU\x10\x07\x12(\n$REBOOT_BNO085_IMU_AND_RESTART_IMU_PY\x10\x08\"4\n\tIssueType\x12\'\n#HEADING_COURSE_DIFFERENCE_TOO_LARGE\x10\x00*4\n\x13IMUCalibrationState\x12\x0f\n\x0bIN_PROGRESS\x10\x01\x12\x0c\n\x08\x43OMPLETE\x10\x02')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,jaiabot_dot_messages_dot_mission__pb2.DESCRIPTOR,])

_IMUCALIBRATIONSTATE = _descriptor.EnumDescriptor(
  name='IMUCalibrationState',
  full_name='jaiabot.protobuf.IMUCalibrationState',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='IN_PROGRESS', index=0, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='COMPLETE', index=1, number=2,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=2549,
  serialized_end=2601,
)
_sym_db.RegisterEnumDescriptor(_IMUCALIBRATIONSTATE)

IMUCalibrationState = enum_type_wrapper.EnumTypeWrapper(_IMUCALIBRATIONSTATE)
IN_PROGRESS = 1
COMPLETE = 2


_IMUCOMMAND_IMUCOMMANDTYPE = _descriptor.EnumDescriptor(
  name='IMUCommandType',
  full_name='jaiabot.protobuf.IMUCommand.IMUCommandType',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='TAKE_READING', index=0, number=0,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='START_WAVE_HEIGHT_SAMPLING', index=1, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='STOP_WAVE_HEIGHT_SAMPLING', index=2, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='START_BOTTOM_TYPE_SAMPLING', index=3, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='STOP_BOTTOM_TYPE_SAMPLING', index=4, number=4,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='START_CALIBRATION', index=5, number=5,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=185,
  serialized_end=368,
)
_sym_db.RegisterEnumDescriptor(_IMUCOMMAND_IMUCOMMANDTYPE)

_IMUISSUE_SOLUTIONTYPE = _descriptor.EnumDescriptor(
  name='SolutionType',
  full_name='jaiabot.protobuf.IMUIssue.SolutionType',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='STOP_BOT', index=0, number=0,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='USE_COG', index=1, number=1,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='USE_CORRECTION', index=2, number=2,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='RESTART_BOT', index=3, number=3,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='REBOOT_BOT', index=4, number=4,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='REPORT_IMU', index=5, number=5,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='RESTART_IMU_PY', index=6, number=6,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='REBOOT_BNO085_IMU', index=7, number=7,
      serialized_options=None,
      type=None),
    _descriptor.EnumValueDescriptor(
      name='REBOOT_BNO085_IMU_AND_RESTART_IMU_PY', index=8, number=8,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=2298,
  serialized_end=2493,
)
_sym_db.RegisterEnumDescriptor(_IMUISSUE_SOLUTIONTYPE)

_IMUISSUE_ISSUETYPE = _descriptor.EnumDescriptor(
  name='IssueType',
  full_name='jaiabot.protobuf.IMUIssue.IssueType',
  filename=None,
  file=DESCRIPTOR,
  values=[
    _descriptor.EnumValueDescriptor(
      name='HEADING_COURSE_DIFFERENCE_TOO_LARGE', index=0, number=0,
      serialized_options=None,
      type=None),
  ],
  containing_type=None,
  serialized_options=None,
  serialized_start=2495,
  serialized_end=2547,
)
_sym_db.RegisterEnumDescriptor(_IMUISSUE_ISSUETYPE)


_IMUCOMMAND = _descriptor.Descriptor(
  name='IMUCommand',
  full_name='jaiabot.protobuf.IMUCommand',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='type', full_name='jaiabot.protobuf.IMUCommand.type', index=0,
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
    _IMUCOMMAND_IMUCOMMANDTYPE,
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=111,
  serialized_end=368,
)


_IMUDATA_EULERANGLES = _descriptor.Descriptor(
  name='EulerAngles',
  full_name='jaiabot.protobuf.IMUData.EulerAngles',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='heading', full_name='jaiabot.protobuf.IMUData.EulerAngles.heading', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\037\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='pitch', full_name='jaiabot.protobuf.IMUData.EulerAngles.pitch', index=1,
      number=2, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\037\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='roll', full_name='jaiabot.protobuf.IMUData.EulerAngles.roll', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\037\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
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
  serialized_start=976,
  serialized_end=1143,
)

_IMUDATA_ACCELERATION = _descriptor.Descriptor(
  name='Acceleration',
  full_name='jaiabot.protobuf.IMUData.Acceleration',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='x', full_name='jaiabot.protobuf.IMUData.Acceleration.x', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='y', full_name='jaiabot.protobuf.IMUData.Acceleration.y', index=1,
      number=2, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='z', full_name='jaiabot.protobuf.IMUData.Acceleration.z', index=2,
      number=3, type=1, cpp_type=5, label=1,
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
  serialized_start=1145,
  serialized_end=1192,
)

_IMUDATA_ACCURACIES = _descriptor.Descriptor(
  name='Accuracies',
  full_name='jaiabot.protobuf.IMUData.Accuracies',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='accelerometer', full_name='jaiabot.protobuf.IMUData.Accuracies.accelerometer', index=0,
      number=1, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000\010@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='gyroscope', full_name='jaiabot.protobuf.IMUData.Accuracies.gyroscope', index=1,
      number=2, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000\010@'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='magnetometer', full_name='jaiabot.protobuf.IMUData.Accuracies.magnetometer', index=2,
      number=3, type=5, cpp_type=1, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\022)\000\000\000\000\000\000\000\0001\000\000\000\000\000\000\010@'), file=DESCRIPTOR),
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
  serialized_start=1195,
  serialized_end=1340,
)

_IMUDATA_ANGULARVELOCITY = _descriptor.Descriptor(
  name='AngularVelocity',
  full_name='jaiabot.protobuf.IMUData.AngularVelocity',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='x', full_name='jaiabot.protobuf.IMUData.AngularVelocity.x', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\031\362\001\026\022\020angular_velocity\032\002si'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='y', full_name='jaiabot.protobuf.IMUData.AngularVelocity.y', index=1,
      number=2, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\031\362\001\026\022\020angular_velocity\032\002si'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='z', full_name='jaiabot.protobuf.IMUData.AngularVelocity.z', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\031\362\001\026\022\020angular_velocity\032\002si'), file=DESCRIPTOR),
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
  serialized_start=1343,
  serialized_end=1483,
)

_IMUDATA_QUATERNION = _descriptor.Descriptor(
  name='Quaternion',
  full_name='jaiabot.protobuf.IMUData.Quaternion',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='w', full_name='jaiabot.protobuf.IMUData.Quaternion.w', index=0,
      number=1, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='x', full_name='jaiabot.protobuf.IMUData.Quaternion.x', index=1,
      number=2, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='y', full_name='jaiabot.protobuf.IMUData.Quaternion.y', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='z', full_name='jaiabot.protobuf.IMUData.Quaternion.z', index=3,
      number=4, type=1, cpp_type=5, label=1,
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
  serialized_start=1485,
  serialized_end=1541,
)

_IMUDATA = _descriptor.Descriptor(
  name='IMUData',
  full_name='jaiabot.protobuf.IMUData',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='euler_angles', full_name='jaiabot.protobuf.IMUData.euler_angles', index=0,
      number=1, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='linear_acceleration', full_name='jaiabot.protobuf.IMUData.linear_acceleration', index=1,
      number=2, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='gravity', full_name='jaiabot.protobuf.IMUData.gravity', index=2,
      number=3, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='accuracies', full_name='jaiabot.protobuf.IMUData.accuracies', index=3,
      number=4, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='calibration_state', full_name='jaiabot.protobuf.IMUData.calibration_state', index=4,
      number=5, type=14, cpp_type=8, label=1,
      has_default_value=False, default_value=1,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='bot_rolled_over', full_name='jaiabot.protobuf.IMUData.bot_rolled_over', index=5,
      number=6, type=8, cpp_type=7, label=1,
      has_default_value=True, default_value=False,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='significant_wave_height', full_name='jaiabot.protobuf.IMUData.significant_wave_height', index=6,
      number=7, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\017\362\001\014\022\006length\032\002si'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='max_acceleration', full_name='jaiabot.protobuf.IMUData.max_acceleration', index=7,
      number=8, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\025\362\001\022\022\014acceleration\032\002si'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='angular_velocity', full_name='jaiabot.protobuf.IMUData.angular_velocity', index=8,
      number=9, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='quaternion', full_name='jaiabot.protobuf.IMUData.quaternion', index=9,
      number=10, type=11, cpp_type=10, label=1,
      has_default_value=False, default_value=None,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='imu_type', full_name='jaiabot.protobuf.IMUData.imu_type', index=10,
      number=11, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[_IMUDATA_EULERANGLES, _IMUDATA_ACCELERATION, _IMUDATA_ACCURACIES, _IMUDATA_ANGULARVELOCITY, _IMUDATA_QUATERNION, ],
  enum_types=[
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=371,
  serialized_end=1541,
)


_IMUISSUE = _descriptor.Descriptor(
  name='IMUIssue',
  full_name='jaiabot.protobuf.IMUIssue',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='solution', full_name='jaiabot.protobuf.IMUIssue.solution', index=0,
      number=1, type=14, cpp_type=8, label=2,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='type', full_name='jaiabot.protobuf.IMUIssue.type', index=1,
      number=2, type=14, cpp_type=8, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='mission_state', full_name='jaiabot.protobuf.IMUIssue.mission_state', index=2,
      number=3, type=14, cpp_type=8, label=1,
      has_default_value=False, default_value=0,
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='imu_heading_course_max_diff', full_name='jaiabot.protobuf.IMUIssue.imu_heading_course_max_diff', index=3,
      number=30, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(45),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='heading', full_name='jaiabot.protobuf.IMUIssue.heading', index=4,
      number=31, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='desired_heading', full_name='jaiabot.protobuf.IMUIssue.desired_heading', index=5,
      number=32, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='course_over_ground', full_name='jaiabot.protobuf.IMUIssue.course_over_ground', index=6,
      number=33, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='heading_course_difference', full_name='jaiabot.protobuf.IMUIssue.heading_course_difference', index=7,
      number=34, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\000\000\0001\000\000\000\000\000\200v@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='pitch', full_name='jaiabot.protobuf.IMUIssue.pitch', index=8,
      number=35, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?3 \000)\000\000\000\000\000\200f\3001\000\000\000\000\000\200f@\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='speed_over_ground', full_name='jaiabot.protobuf.IMUIssue.speed_over_ground', index=9,
      number=36, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?% \001)\000\000\000\000\000\000\024\3001\000\000\000\000\000\000$@\362\001\016\022\010velocity\032\002si'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='desired_speed', full_name='jaiabot.protobuf.IMUIssue.desired_speed', index=10,
      number=37, type=1, cpp_type=5, label=1,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?% \001)\000\000\000\000\000\000\024\3001\000\000\000\000\000\000$@\362\001\016\022\010velocity\032\002si'), file=DESCRIPTOR),
  ],
  extensions=[
  ],
  nested_types=[],
  enum_types=[
    _IMUISSUE_SOLUTIONTYPE,
    _IMUISSUE_ISSUETYPE,
  ],
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=1544,
  serialized_end=2547,
)

_IMUCOMMAND.fields_by_name['type'].enum_type = _IMUCOMMAND_IMUCOMMANDTYPE
_IMUCOMMAND_IMUCOMMANDTYPE.containing_type = _IMUCOMMAND
_IMUDATA_EULERANGLES.containing_type = _IMUDATA
_IMUDATA_ACCELERATION.containing_type = _IMUDATA
_IMUDATA_ACCURACIES.containing_type = _IMUDATA
_IMUDATA_ANGULARVELOCITY.containing_type = _IMUDATA
_IMUDATA_QUATERNION.containing_type = _IMUDATA
_IMUDATA.fields_by_name['euler_angles'].message_type = _IMUDATA_EULERANGLES
_IMUDATA.fields_by_name['linear_acceleration'].message_type = _IMUDATA_ACCELERATION
_IMUDATA.fields_by_name['gravity'].message_type = _IMUDATA_ACCELERATION
_IMUDATA.fields_by_name['accuracies'].message_type = _IMUDATA_ACCURACIES
_IMUDATA.fields_by_name['calibration_state'].enum_type = _IMUCALIBRATIONSTATE
_IMUDATA.fields_by_name['angular_velocity'].message_type = _IMUDATA_ANGULARVELOCITY
_IMUDATA.fields_by_name['quaternion'].message_type = _IMUDATA_QUATERNION
_IMUISSUE.fields_by_name['solution'].enum_type = _IMUISSUE_SOLUTIONTYPE
_IMUISSUE.fields_by_name['type'].enum_type = _IMUISSUE_ISSUETYPE
_IMUISSUE.fields_by_name['mission_state'].enum_type = jaiabot_dot_messages_dot_mission__pb2._MISSIONSTATE
_IMUISSUE_SOLUTIONTYPE.containing_type = _IMUISSUE
_IMUISSUE_ISSUETYPE.containing_type = _IMUISSUE
DESCRIPTOR.message_types_by_name['IMUCommand'] = _IMUCOMMAND
DESCRIPTOR.message_types_by_name['IMUData'] = _IMUDATA
DESCRIPTOR.message_types_by_name['IMUIssue'] = _IMUISSUE
DESCRIPTOR.enum_types_by_name['IMUCalibrationState'] = _IMUCALIBRATIONSTATE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

IMUCommand = _reflection.GeneratedProtocolMessageType('IMUCommand', (_message.Message,), dict(
  DESCRIPTOR = _IMUCOMMAND,
  __module__ = 'jaiabot.messages.imu_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUCommand)
  ))
_sym_db.RegisterMessage(IMUCommand)

IMUData = _reflection.GeneratedProtocolMessageType('IMUData', (_message.Message,), dict(

  EulerAngles = _reflection.GeneratedProtocolMessageType('EulerAngles', (_message.Message,), dict(
    DESCRIPTOR = _IMUDATA_EULERANGLES,
    __module__ = 'jaiabot.messages.imu_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUData.EulerAngles)
    ))
  ,

  Acceleration = _reflection.GeneratedProtocolMessageType('Acceleration', (_message.Message,), dict(
    DESCRIPTOR = _IMUDATA_ACCELERATION,
    __module__ = 'jaiabot.messages.imu_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUData.Acceleration)
    ))
  ,

  Accuracies = _reflection.GeneratedProtocolMessageType('Accuracies', (_message.Message,), dict(
    DESCRIPTOR = _IMUDATA_ACCURACIES,
    __module__ = 'jaiabot.messages.imu_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUData.Accuracies)
    ))
  ,

  AngularVelocity = _reflection.GeneratedProtocolMessageType('AngularVelocity', (_message.Message,), dict(
    DESCRIPTOR = _IMUDATA_ANGULARVELOCITY,
    __module__ = 'jaiabot.messages.imu_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUData.AngularVelocity)
    ))
  ,

  Quaternion = _reflection.GeneratedProtocolMessageType('Quaternion', (_message.Message,), dict(
    DESCRIPTOR = _IMUDATA_QUATERNION,
    __module__ = 'jaiabot.messages.imu_pb2'
    # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUData.Quaternion)
    ))
  ,
  DESCRIPTOR = _IMUDATA,
  __module__ = 'jaiabot.messages.imu_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUData)
  ))
_sym_db.RegisterMessage(IMUData)
_sym_db.RegisterMessage(IMUData.EulerAngles)
_sym_db.RegisterMessage(IMUData.Acceleration)
_sym_db.RegisterMessage(IMUData.Accuracies)
_sym_db.RegisterMessage(IMUData.AngularVelocity)
_sym_db.RegisterMessage(IMUData.Quaternion)

IMUIssue = _reflection.GeneratedProtocolMessageType('IMUIssue', (_message.Message,), dict(
  DESCRIPTOR = _IMUISSUE,
  __module__ = 'jaiabot.messages.imu_pb2'
  # @@protoc_insertion_point(class_scope:jaiabot.protobuf.IMUIssue)
  ))
_sym_db.RegisterMessage(IMUIssue)


_IMUDATA_EULERANGLES.fields_by_name['heading']._options = None
_IMUDATA_EULERANGLES.fields_by_name['pitch']._options = None
_IMUDATA_EULERANGLES.fields_by_name['roll']._options = None
_IMUDATA_ACCURACIES.fields_by_name['accelerometer']._options = None
_IMUDATA_ACCURACIES.fields_by_name['gyroscope']._options = None
_IMUDATA_ACCURACIES.fields_by_name['magnetometer']._options = None
_IMUDATA_ANGULARVELOCITY.fields_by_name['x']._options = None
_IMUDATA_ANGULARVELOCITY.fields_by_name['y']._options = None
_IMUDATA_ANGULARVELOCITY.fields_by_name['z']._options = None
_IMUDATA.fields_by_name['significant_wave_height']._options = None
_IMUDATA.fields_by_name['max_acceleration']._options = None
_IMUISSUE.fields_by_name['heading']._options = None
_IMUISSUE.fields_by_name['desired_heading']._options = None
_IMUISSUE.fields_by_name['course_over_ground']._options = None
_IMUISSUE.fields_by_name['heading_course_difference']._options = None
_IMUISSUE.fields_by_name['pitch']._options = None
_IMUISSUE.fields_by_name['speed_over_ground']._options = None
_IMUISSUE.fields_by_name['desired_speed']._options = None
# @@protoc_insertion_point(module_scope)