import h5py
from pyjaia.series import Series
from pyjaia.h5_tools import *
from google.protobuf.message import Message
from google.protobuf.descriptor import Descriptor, FieldDescriptor
from typing import Set, Any
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

    def __init__(self, log_path: str):
        self.log_path = log_path
        self.log = h5py.File(log_path, "r")


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
        series.hovertext_map = {}

        path = self.get_path(path)
        l.info(color_text(f'Loading series from path {path} in file {self.log.filename}', 'green'))

        # Load the _utime_ and _scheme_ arrays            
        try:
            _utime__array = self.log[get_root_item_path(path, '_utime_')]
            _scheme__array = self.log[get_root_item_path(path, '_scheme_')]
        except KeyError as e:
            raise KeyError(color_text(f'Could not load _utime_ or _scheme_ arrays for path {path} in file {self.log.filename}: {e}', 'red'))

        path_array = self.log[path]

        # Check to see if this is a string dataset
        is_string = len(path_array.shape) == 2 and path + '_size' in self.log

        data_array = h5_get_string_series(path_array, self.log[path + '_size']) if is_string else h5_get_series(path_array)

        s = zip(h5_get_series(_utime__array), h5_get_series(_scheme__array), data_array)
        s = filter(lambda pt: pt[1] == scheme and pt[2] not in invalid_values, s)

        if is_string:
            series.utime, _, string_array = zip(*s)
            series.y_values = [0.0] * len(series.utime)
            series.hovertext = list(string_array)
            series.hovertext_map = None
        else:
            series.utime, _, series.y_values = zip(*s)
            series.hovertext_map = h5_get_enum_map(self.log[path]) or {}
            series.hovertext = None

        return series

    def read_protobuf_objects(self, path: str, protobuf_message_name: Message) -> List[T]:
        """Load a list of objects from a path.

        Args:
            path (str): Path to the Jaia dataset to load.
            object (T): The type of object to load.
        """

        path = self.get_path(path)

        objects: List[T] = []

        descriptor = protobuf_message_name.DESCRIPTOR

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
            FieldDescriptor.TYPE_ENUM
        }

        for field in descriptor.fields:
            field: FieldDescriptor

            if field.label == FieldDescriptor.LABEL_REPEATED:
                l.warning(color_text(f'Field {field.name} is repeated.  This is not supported yet.', 'red'))
                continue

            field_path = path + '/' + field.name

            if field.type in SCALAR_TYPES:
                try:
                    field_data = self.read_array(field_path, is_string=(field.type == FieldDescriptor.TYPE_STRING))
                except KeyError:
                    l.warning(color_text(f'Could not find dataset for field {field.name} in protobuf {protobuf_message_name.DESCRIPTOR.name}', 'yellow'))
                    continue

                for index, value in enumerate(field_data):
                    if index >= len(objects):
                        objects.append(protobuf_message_name())
                    if value is not None:
                        setattr(objects[index], field.name, value)
            elif field.type == FieldDescriptor.TYPE_MESSAGE:
                nested_objects = self.read_protobuf_objects(field_path, protobuf_message_name=field.message_type._concrete_class)
                l.warning(color_text(f'Loaded {len(nested_objects)} nested objects for field {field.name}', 'green'))
                for index, nested_object in enumerate(nested_objects):
                    if index >= len(objects):
                        objects.append(protobuf_message_name())
                    getattr(objects[index], field.name).CopyFrom(nested_object)
            else:
                l.warning(color_text(f'Field {field.name} has unsupported type {field.type}', 'red'))
                continue
        
        return objects
