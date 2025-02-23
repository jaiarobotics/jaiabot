#!/usr/env python3

from dataclasses import *
from typing import *
import json

normal_types = set([int, float, str, bool, type(None)])


def normalize(obj: any):
    t = type(obj)

    if t in normal_types:
        return obj
    
    if t == list:
        return [normalize(item) for item in obj]

    if t == dict:
        return {key: normalize(obj[key]) for key in obj}
    
    # python objects
    return {key: normalize(getattr(obj, key)) for key in vars(obj)}


def denormalize(obj: any, Class):
    if Class is None:
        return obj

    t = type(obj)

    if Class == t:
        return obj
    
    if Class == float and t == int:
        return float(obj)

    if Class == list:
        return [item for item in obj]

    if Class == dict:
        return {key: obj[key] for key in obj}
    
    if get_origin(Class) == list:
        assert(t == list)
        type_args = get_args(Class)
        
        if len(type_args) == 0:
            # No type arguments
            return [item for item in obj]

        return [denormalize(item, type_args[0]) for item in obj]

    if get_origin(Class) == dict:
        assert(t == dict)
        type_args = get_args(Class)
        
        if len(type_args) == 0:
            # No type arguments
            return {key: obj[key] for key in obj}
        
        key_type, value_type = type_args
        assert(key_type == str)
        value_type = type_args[1]
        return {key: denormalize(obj[key], value_type) for key in obj}

    # python objects
    if t != dict:
        raise Exception(f"Need a dict, but got {t} when denormalizing to a class.  {obj=}, {Class=}")
    
    kwargs = {}
    for var_name, type_hint in get_type_hints(Class).items():
        if var_name in obj:
            kwargs[var_name] = denormalize(obj[var_name], type_hint)
    return Class(**kwargs)


def dumps(obj: any):
    return json.dumps(normalize(obj))


def dump(obj: any, fp):
    json.dump(normalize(obj), fp, indent=4, sort_keys=True)


def loads(s: str | bytes | bytearray, Class):
    return denormalize(json.loads(s), Class)


def load(fp, Class):
    return denormalize(json.load(fp), Class)


def main():
    @dataclass
    class E:
        c: bool = False
        d: int = None
        e: List[int] = field(default_factory=list)
        f: Dict[str, int] = field(default_factory=dict)

    @dataclass
    class Test:
        a: int = 5
        b: str = 'test'
        c: Dict[str, E] = field(default_factory=dict)

    obj = Test(a=7, b='asdf', c={'test1': E(c=False, d=999, e=[1, 3, 8, 0], f={'a': 99})})

    dump(obj, open('test.json', 'w'))

    obj2 = load(open('test.json'), Test)

    print(obj)
    print(obj2)

if __name__ == '__main__':
    main()
