from google.protobuf.descriptor import FieldDescriptor


if not hasattr(FieldDescriptor, "is_repeated"):
    FieldDescriptor.is_repeated = property(
        lambda field: field.label == FieldDescriptor.LABEL_REPEATED
    )
