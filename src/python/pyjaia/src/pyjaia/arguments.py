import argparse
from dataclasses import fields
from typing import *


def add_arguments(parser: argparse.ArgumentParser, args_obj):
    """Adds arguments from a dataclass object, to an argparse.ArgumentParser

    Args:
        parser (argparse.ArgumentParser): The argument parser.
        args_obj (_type_): The dataclass containing the argument variables and add_argument function arguments.

    Example:
        Your Args class must look like this:

        ```
        @dataclass
        class Args:
            hdf5_file: str = None
            _hdf5_file_argparse = {'help': 'The HDF5 file'}

            data_paths: List[str] = None
            _data_paths_argparse = {'nargs': '+', 'help': 'HDF5 paths to the data (Can be part of the path or a regex)'}

            split_mission_state: str = None
            _split_mission_state_argparse = {'flags': ['-s'], 'help': 'Name of the mission_state value to use to split the series'}

        parser = argparse.ArgumentParser('foo', description='bar')
        add_arguments(parser, Args())
        ```

    """
    for field in fields(args_obj):
        if field.name[0] == '_':
            continue

        argparse_params_field = f'_{field.name}_argparse'
        if hasattr(args_obj, argparse_params_field):
            argparse_params: Dict[str: Any] = getattr(args_obj, argparse_params_field)
            if 'flags' in argparse_params:
                name_or_flags = argparse_params.pop('flags')
                argparse_params['dest'] = field.name
            else:
                name_or_flags = [field.name]

            parser.add_argument(*name_or_flags, **argparse_params)

