# Generated by the protocol buffer compiler.  DO NOT EDIT!
# source: goby/middleware/protobuf/geographic.proto

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
  name='goby/middleware/protobuf/geographic.proto',
  package='goby.middleware.protobuf',
  syntax='proto2',
  serialized_options=None,
  serialized_pb=_b('\n)goby/middleware/protobuf/geographic.proto\x12\x18goby.middleware.protobuf\x1a\x1c\x64\x63\x63l/option_extensions.proto\"\xc2\x01\n\x0bLatLonPoint\x12/\n\x03lat\x18\x01 \x02(\x01\x42\"\xa2?\x1f\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12/\n\x03lon\x18\x02 \x02(\x01\x42\"\xa2?\x1f\xf2\x01\x1c\x12\x0bplane_angle\x1a\rangle::degree\x12 \n\x05\x64\x65pth\x18\x03 \x01(\x01:\x01\x30\x42\x0e\xa2?\x0b\xf2\x01\x08\x12\x06length\x12%\n\x08\x61ltitude\x18\x04 \x01(\x01:\x03nanB\x0e\xa2?\x0b\xf2\x01\x08\x12\x06length:\x08\xa2?\x05\xf2\x01\x02si\"Q\n\x08Waypoint\x12\x0c\n\x04name\x18\x01 \x01(\t\x12\x37\n\x08location\x18\x02 \x02(\x0b\x32%.goby.middleware.protobuf.LatLonPoint\"H\n\x05Route\x12\x0c\n\x04name\x18\x01 \x01(\t\x12\x31\n\x05point\x18\x02 \x03(\x0b\x32\".goby.middleware.protobuf.Waypoint')
  ,
  dependencies=[dccl_dot_option__extensions__pb2.DESCRIPTOR,])




_LATLONPOINT = _descriptor.Descriptor(
  name='LatLonPoint',
  full_name='goby.middleware.protobuf.LatLonPoint',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='lat', full_name='goby.middleware.protobuf.LatLonPoint.lat', index=0,
      number=1, type=1, cpp_type=5, label=2,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\037\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='lon', full_name='goby.middleware.protobuf.LatLonPoint.lon', index=1,
      number=2, type=1, cpp_type=5, label=2,
      has_default_value=False, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\037\362\001\034\022\013plane_angle\032\rangle::degree'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='depth', full_name='goby.middleware.protobuf.LatLonPoint.depth', index=2,
      number=3, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=float(0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\013\362\001\010\022\006length'), file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='altitude', full_name='goby.middleware.protobuf.LatLonPoint.altitude', index=3,
      number=4, type=1, cpp_type=5, label=1,
      has_default_value=True, default_value=(1e10000 * 0),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=_b('\242?\013\362\001\010\022\006length'), file=DESCRIPTOR),
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
  serialized_start=102,
  serialized_end=296,
)


_WAYPOINT = _descriptor.Descriptor(
  name='Waypoint',
  full_name='goby.middleware.protobuf.Waypoint',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='name', full_name='goby.middleware.protobuf.Waypoint.name', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='location', full_name='goby.middleware.protobuf.Waypoint.location', index=1,
      number=2, type=11, cpp_type=10, label=2,
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
  serialized_options=None,
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=298,
  serialized_end=379,
)


_ROUTE = _descriptor.Descriptor(
  name='Route',
  full_name='goby.middleware.protobuf.Route',
  filename=None,
  file=DESCRIPTOR,
  containing_type=None,
  fields=[
    _descriptor.FieldDescriptor(
      name='name', full_name='goby.middleware.protobuf.Route.name', index=0,
      number=1, type=9, cpp_type=9, label=1,
      has_default_value=False, default_value=_b("").decode('utf-8'),
      message_type=None, enum_type=None, containing_type=None,
      is_extension=False, extension_scope=None,
      serialized_options=None, file=DESCRIPTOR),
    _descriptor.FieldDescriptor(
      name='point', full_name='goby.middleware.protobuf.Route.point', index=1,
      number=2, type=11, cpp_type=10, label=3,
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
  is_extendable=False,
  syntax='proto2',
  extension_ranges=[],
  oneofs=[
  ],
  serialized_start=381,
  serialized_end=453,
)

_WAYPOINT.fields_by_name['location'].message_type = _LATLONPOINT
_ROUTE.fields_by_name['point'].message_type = _WAYPOINT
DESCRIPTOR.message_types_by_name['LatLonPoint'] = _LATLONPOINT
DESCRIPTOR.message_types_by_name['Waypoint'] = _WAYPOINT
DESCRIPTOR.message_types_by_name['Route'] = _ROUTE
_sym_db.RegisterFileDescriptor(DESCRIPTOR)

LatLonPoint = _reflection.GeneratedProtocolMessageType('LatLonPoint', (_message.Message,), dict(
  DESCRIPTOR = _LATLONPOINT,
  __module__ = 'goby.middleware.protobuf.geographic_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.LatLonPoint)
  ))
_sym_db.RegisterMessage(LatLonPoint)

Waypoint = _reflection.GeneratedProtocolMessageType('Waypoint', (_message.Message,), dict(
  DESCRIPTOR = _WAYPOINT,
  __module__ = 'goby.middleware.protobuf.geographic_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.Waypoint)
  ))
_sym_db.RegisterMessage(Waypoint)

Route = _reflection.GeneratedProtocolMessageType('Route', (_message.Message,), dict(
  DESCRIPTOR = _ROUTE,
  __module__ = 'goby.middleware.protobuf.geographic_pb2'
  # @@protoc_insertion_point(class_scope:goby.middleware.protobuf.Route)
  ))
_sym_db.RegisterMessage(Route)


_LATLONPOINT.fields_by_name['lat']._options = None
_LATLONPOINT.fields_by_name['lon']._options = None
_LATLONPOINT.fields_by_name['depth']._options = None
_LATLONPOINT.fields_by_name['altitude']._options = None
_LATLONPOINT._options = None
# @@protoc_insertion_point(module_scope)