#!/usr/bin/env python3

import os
import sys
import tempfile
import unittest

SOURCE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, os.path.join(SOURCE_DIR, "src", "python", "h5"))

try:
    import h5py
    import numpy
except ImportError:
    h5py = None


@unittest.skipIf(h5py is None, "h5py is not installed")
class TestH5Size(unittest.TestCase):
    def setUp(self):
        import h5size
        self.h5size = h5size
        fd, self.path = tempfile.mkstemp(suffix=".h5")
        os.close(fd)
        with h5py.File(self.path, "w") as f:
            f["a/x"] = numpy.zeros(10, dtype=numpy.uint8)
            f["a/y"] = numpy.zeros(20, dtype=numpy.uint8)
            f["b/c/z"] = numpy.zeros(40, dtype=numpy.uint8)

    def tearDown(self):
        os.remove(self.path)

    def test_each_node_counts_its_datasets_once(self):
        root = self.h5size.getRootNode(self.path)

        self.assertEqual(root.nbytes, 70)
        self.assertEqual(root.children["a"].nbytes, 30)
        self.assertEqual(root.children["a"].children["x"].nbytes, 10)
        self.assertEqual(root.children["a"].children["y"].nbytes, 20)
        self.assertEqual(root.children["b"].nbytes, 40)
        self.assertEqual(root.children["b"].children["c"].nbytes, 40)
        self.assertEqual(root.children["b"].children["c"].children["z"].nbytes, 40)


if __name__ == "__main__":
    unittest.main()
