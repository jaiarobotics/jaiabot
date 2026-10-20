"""A list under an include's vars stops the play before any task runs.

ansible-core 2.20 - what Ubuntu 26.04, and so a 3.y CloudHub, ships - requires the
vars of include_tasks and import_tasks to be a mapping:

    ERROR! Vars in a TaskInclude must be specified as a dictionary.

Older ansible read a list of one-key mappings too, so the playbooks that carried one
worked on a 2.y CloudHub and failed on a 3.y one. Every include is checked here,
including the task files, which --syntax-check never reaches.
"""

import pathlib
import unittest

import yaml

INCLUDES = ("include_tasks", "import_tasks", "include_role", "import_role")
ANSIBLE_DIR = pathlib.Path(__file__).resolve().parents[3] / "config" / "ansible"


def include_vars(node, path, found):
    if isinstance(node, list):
        for item in node:
            include_vars(item, path, found)
    elif isinstance(node, dict):
        if any(key in node for key in INCLUDES) and "vars" in node:
            found.append((path, node["vars"]))
        for value in node.values():
            include_vars(value, path, found)


class TestIncludeVars(unittest.TestCase):
    def test_include_vars_are_mappings(self):
        offenders = []
        includes = 0
        for path in sorted(ANSIBLE_DIR.rglob("*.yml")):
            with open(path) as f:
                documents = list(yaml.safe_load_all(f))
            found = []
            include_vars(documents, path, found)
            for _, vars_ in found:
                includes += 1
                if not isinstance(vars_, dict):
                    offenders.append("{}: vars is a {}".format(
                        path.relative_to(ANSIBLE_DIR), type(vars_).__name__))
        self.assertGreater(includes, 0, "no include with vars found; is ANSIBLE_DIR right?")
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
