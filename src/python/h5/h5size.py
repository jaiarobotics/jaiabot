#!/usr/bin/env python3

import sys
import h5py
import argparse

from typing import Dict
from dataclasses import dataclass


@dataclass
class SizeNode:
    name: str
    nbytes: int
    children: Dict[str, '__class__']

    def print(self, levels=1, indent=0):
        if levels < 0:
            return

        pre = ' ' * indent

        print(f'{self.nbytes: 15d} {pre+self.name:64s}')
        
        children_sorted = sorted(self.children.values(), key=lambda node: node.nbytes, reverse=True)

        for child in children_sorted:
            child.print(levels - 1, indent + 2)


def getRootNode(h5_filename: str):
    rootNode = SizeNode('/', 0, {})

    def addDataset(name: str, dataset: h5py.Dataset):
        try:
            nbytes = dataset.nbytes
        except AttributeError:
            # This is a Group
            return

        components = name.split('/')

        currentNode = rootNode
        for component in components:
            currentNode.nbytes += nbytes

            try:
                currentNode = currentNode.children[component]
            except KeyError:
                currentNode.children[component] = SizeNode(component, nbytes, {})
                currentNode = currentNode.children[component]

    h5py.File(h5_filename).visititems(addDataset)

    return rootNode


if __name__ == '__main__':
    parser = argparse.ArgumentParser('h5size.py', description='Shows the total bytes taken up by the datasets in an h5 file')
    parser.add_argument('input_file', help='path to the HDF5 file')
    parser.add_argument('-d', type=int, default=1, help='Depth to traverse the dataset tree (default=1)')

    args = parser.parse_args()

    getRootNode(args.input_file).print(levels=args.d)
