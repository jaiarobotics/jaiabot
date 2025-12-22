import pathlib
import h5py
from pyjaia.series import Series
from google.protobuf.message import Message
from google.protobuf.descriptor import FieldDescriptor, Descriptor
from typing import Callable, Set, Any, TypeVar, List
import re
import logging
import numpy as np


l = logging.getLogger(__name__)

T = TypeVar('T')


def color_text(self: str, color: str) -> str:
    color_codes = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'magenta': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'reset': '\033[0m'
    }
    return color_codes.get(color, '') + self + color_codes['reset']


def get_root_item_path(path: str, desired_relative_path=''):
    """Gets the path to a field under the root item of a given path.

    Args:
        path (str): Path to get the root item path for.
        desired_relative_path (str, optional): The desired path relative to the root path. Defaults to '', which gets the class's root path.

    Returns:
        str: Desired absolute path.
    """
    components = path.strip('/').split('/')
    components = components[:2] + [desired_relative_path]
    return '/'.join(components)


def get_enum_map(dataset: h5py.Dataset):
    """Get the enum map (enum_value -> enum_name dict) for an h5 dataset

    Args:
        dataset (h5py.Dataset): The dataset (hopefully an enum dataset)

    Returns:
        dict[int, str]: A dictionary mapping enum values to their corresponding user-readable enum names, or None if this is not an enum dataset
    """
    # Get the enum value names
    try:
        enum_names: List[str] = dataset.attrs['enum_names']
        enum_values: List[int] = dataset.attrs['enum_values']
        enum_dict = { int(enum_values[index]): enum_names[index] for index in range(0, len(enum_values))}
        return enum_dict

    except KeyError:
        return None


def paths_match(path1: str, path2: str) -> bool:
    """Compare two paths, disregarding bot_id-related components.

    Args:
        path1 (str): Path to compare
        path2 (str): Other path to compare

    Returns:
        bool: True if the paths match disregarding bot_id-related components, False otherwise.
    """
    return re.sub(r';\d+', '', path1) == re.sub(r';\d+', '', path2)


def get_data_by_index(dataset: h5py.Dataset, indices: tuple[int]) -> Any:
    """Get data from a dataset by index.

    Args:
        dataset (h5py.Dataset): The dataset to get data from.
        indices (tuple[int]): The indices to get data for.

    Returns:
        Any: The data at the specified indices.
    """
    item: Any = dataset

    while len(indices) > 0:
        item = item[indices[0]]
        indices = indices[1:]
    return item


def increment_indices(indices: tuple[int], shape: tuple[int]) -> tuple[int]:
    """Increment a tuple of indices, wrapping around according to the shape.

    Args:
        indices (tuple[int]): The current indices.
        shape (tuple[int]): The shape to wrap around.

    Returns:
        tuple[int]: The incremented indices.
    """
    r = list(indices)
    for i in range(len(r) - 1, -1, -1):
        r[i] += 1
        if r[i] < shape[i]:
            break
        else:
            r[i] = 0
    return tuple(r)


def assign_item(nested_list: list, indices: tuple[int], value: Any):
    """Assign a value to a nested list at the specified indices.

    Args:
        nested_list (list): The nested list to assign to.
        indices (tuple[int]): The indices to assign at.
        value (Any): The value to assign.
    """
    item = nested_list
    for index in indices[:-1]:
        if index >= len(item):
            item.append([])
        item = item[index]

    l.debug(color_text(f'Assigning value {value} at indices {indices}', 'yellow'))

    if indices[-1] < len(item):
        item[indices[-1]] = value
    elif indices[-1] == len(item):
        item.append(value)
    else:
        raise IndexError(color_text(f'Index {indices[-1]} out of bounds for list of length {len(item)}', 'red'))


def filter_dataset_to_list(dataset: h5py.Dataset) -> List[int | float | None]:
    """Filter out "invalid" values from an h5 dataset.

    Args:
        dataset (h5py.Dataset): The dataset to filter.
    """
    INT32_MAX = (2 << 30) - 1
    UINT32_MAX = (2 << 31) - 1

    NONE_VALUES = {
        float('nan'),
        INT32_MAX,
        UINT32_MAX
    }

    def filter_thing(thing: Any) -> Any:
        if isinstance(thing, list):
            return [filter_thing(x) for x in thing]
        elif thing in NONE_VALUES:
            return None
        else:
            return thing

    data_list = np.array(dataset).tolist()

    return filter_thing(data_list)


class JaiaLogH5:

    log: h5py.File
    log_path: str

    def __init__(self, log_or_path: h5py.File | str | pathlib.Path):
        if isinstance(log_or_path, h5py.File):
            self.log = log_or_path
            self.log_path = log_or_path.filename
        elif isinstance(log_or_path, str) or isinstance(log_or_path, pathlib.Path):
            self.log_path = str(log_or_path)
            self.log = h5py.File(log_or_path, "r")
        else:
            raise TypeError(color_text(f'log_or_path must be of type h5py.File or str, not {type(log_or_path)}', 'red'))


    def get_path(self, path: str) -> str:
        """Get the path to a dataset in the log file, disregarding bot_id-related components.

        Args:
            path (str): The path to get.

        Returns:
            str: The path to the dataset in the log file.
        """
        matched_path = self.log.visit(lambda name: name if paths_match(name, path) else None)
        if matched_path is None:
            raise KeyError(color_text(f'Could not find path {path} in file {self.log.filename}', 'red'))
        else:
            l.info(color_text(f'Using matched path {matched_path} in file {self.log.filename}', 'green'))
            return matched_path


    def read_array(self, path: str, is_string: bool=False) -> List[Any]:
        """Load an array from a path.

        Args:
            path (str): Path to the Jaia dataset to load.
        """
        path = self.get_path(path)

        dataset = self.log.get(path)
        if dataset is None:
            raise KeyError(color_text(f'Could not find dataset at path {path} in file {self.log.filename}', 'red'))

        if is_string:
            string_size_path = self.get_path(path + '_size')
            string_size_dataset = self.log.get(string_size_path)
            if string_size_dataset is None:
                raise KeyError(color_text(f'Could not find dataset at path {string_size_path} in file {self.log.filename}', 'red'))
            
            return_array_shape = dataset.shape[:-1]
            return_array = []

            return_array_indices = (0,) * len(return_array_shape)
            
            while True:
                data = get_data_by_index(dataset, return_array_indices)
                string_size = get_data_by_index(string_size_dataset, return_array_indices)
                new_string = data[:string_size].tobytes().decode('utf8')
                assign_item(return_array, return_array_indices, new_string)

                return_array_indices = increment_indices(return_array_indices, return_array_shape)
                if return_array_indices == (0,) * len(return_array_shape):
                    break
            
            return return_array
        else:
            return filter_dataset_to_list(dataset)


    def read_series(self, path: str, scheme: int=1, invalid_values: Set[Any]=None, name="Untitled") -> "Series":
        """Load a Series object from a path.

        Args:
            path (str): Path to the Jaia dataset to load.
            scheme (int, optional): The Goby transport scheme to filter out. Defaults to 1.
            invalid_values (Set[Any], optional): A set of values to consider "invalid" and replace with None. Defaults to set().
            name (str, optional): Name of the Series object. Defaults to "Untitled".

        Raises:
            Exception: When we cannot load the dataset array, or its _utime_ or _scheme_ arrays.

        Returns:
            Series: The Series object representing this data series.

        Note:
            If `path` contains a post-semicolon component, it will match any string beyond that point in the component.
                For example:
                    `jaiabot::bot_status;0/jaiabot.protobuf.BotStatus/mission_state` will match the path
                    `jaiabot::bot_status;1/jaiabot.protobuf.BotStatus/mission_state`
        """
        invalid_values = invalid_values or set()

        series = Series(name)

        series.utime = []
        series.y_values = []
        series.hovertext_map = None

        path = self.get_path(path)
        l.info(color_text(f'Loading series from path {path} in file {self.log.filename}', 'green'))

        path_array = self.log[path]

        # Check to see if this is a string dataset
        is_string = len(path_array.shape) == 2 and path + '_size' in self.log

        # Load the arrays
        _utime__array = self.read_array(get_root_item_path(path, '_utime_'))
        _scheme__array = self.read_array(get_root_item_path(path, '_scheme_'))
        data_array = self.read_array(path, is_string=is_string)
        s = zip(_utime__array, _scheme__array, data_array)
        s = filter(lambda pt: pt[1] == scheme and pt[2] not in invalid_values, s)

        if is_string:
            series.utime, _, string_array = zip(*s)
            series.y_values = [0.0] * len(series.utime)
            series.hovertext = list(string_array)
            series.hovertext_map = None
        else:
            series.utime, _, series.y_values = zip(*s)
            series.hovertext_map = get_enum_map(self.log[path])
            series.hovertext = None

        return series

    def read_protobuf_objects(self, path: str, ProtobufMessage: Callable[[], T]) -> List[T]:
        """Load a list of objects from a path.

        Args:
            path (str): Path to the Jaia dataset to load.
            object (T): The type of object to load.
        """

        path = self.get_path(path)

        objects: List[T] = []

        descriptor: Descriptor = ProtobufMessage.DESCRIPTOR

        SCALAR_TYPES: Set = {
            FieldDescriptor.TYPE_DOUBLE, 
            FieldDescriptor.TYPE_FLOAT, 
            FieldDescriptor.TYPE_INT64, 
            FieldDescriptor.TYPE_UINT64, 
            FieldDescriptor.TYPE_UINT32,
            FieldDescriptor.TYPE_INT32,
            FieldDescriptor.TYPE_FIXED64,
            FieldDescriptor.TYPE_FIXED32,
            FieldDescriptor.TYPE_BOOL,
            FieldDescriptor.TYPE_BYTES,
            FieldDescriptor.TYPE_ENUM,
            FieldDescriptor.TYPE_STRING,
        }

        for field in descriptor.fields:
            field: FieldDescriptor

            # if field.label == FieldDescriptor.LABEL_REPEATED:
            #     l.warning(color_text(f'Field {field.name} is repeated.  This is not supported yet.', 'red'))
            #     continue

            field_path = path + '/' + field.name

            if field.type in SCALAR_TYPES:
                try:
                    field_data = self.read_array(field_path, is_string=(field.type == FieldDescriptor.TYPE_STRING))
                except KeyError:
                    l.warning(color_text(f'Could not find dataset for field {field.name} in protobuf {ProtobufMessage.DESCRIPTOR.name}', 'yellow'))
                    continue

                for index, value in enumerate(field_data):
                    if index >= len(objects):
                        objects.append(ProtobufMessage())
                    if value is not None:
                        if field.label == FieldDescriptor.LABEL_REPEATED:
                            getattr(objects[index], field.name).extend(filter(lambda x: x is not None, value))
                        else:
                            setattr(objects[index], field.name, value)

            elif field.type == FieldDescriptor.TYPE_MESSAGE:
                if field.label == FieldDescriptor.LABEL_REPEATED:
                    l.warning(color_text(f'Field {field.name} is a repeated message field.  This is not supported yet.', 'red'))
                    continue

                nested_objects = self.read_protobuf_objects(field_path, ProtobufMessage=field.message_type._concrete_class)
                for index, nested_object in enumerate(nested_objects):
                    if index >= len(objects):
                        objects.append(ProtobufMessage())
                    getattr(objects[index], field.name).CopyFrom(nested_object)

            else:
                l.warning(color_text(f'Field {field.name} has unsupported type {field.type}', 'red'))
                continue
        
        return objects
