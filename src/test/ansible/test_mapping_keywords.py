"""A list where Ansible wants a mapping stops the play before any task runs.

ansible-core 2.20 - what Ubuntu 26.04, and so a 3.y CloudHub, ships - requires the
vars of a play, block, task or include, and a task's args, set_fact and loop_control,
to be mappings:

    ERROR! Vars in a TaskInclude must be specified as a dictionary.

Older ansible read a list of one-key mappings too, so a playbook that carried one
worked on a 2.y CloudHub and failed on a 3.y one. Every file is checked here,
including the task files, which --syntax-check never reaches.
"""

import pathlib
import unittest

import yaml

MAPPING_KEYWORDS = ("vars", "args", "set_fact", "loop_control")
ANSIBLE_DIR = pathlib.Path(__file__).resolve().parents[3] / "config" / "ansible"


def mapping_keywords(node, path, found):
    if isinstance(node, list):
        for item in node:
            mapping_keywords(item, path, found)
    elif isinstance(node, dict):
        for key in MAPPING_KEYWORDS:
            if key in node:
                found.append((path, key, node[key]))
        for value in node.values():
            mapping_keywords(value, path, found)


class TestMappingKeywords(unittest.TestCase):
    def test_mapping_keywords_are_mappings(self):
        offenders = []
        checked = 0
        for path in sorted(ANSIBLE_DIR.rglob("*.yml")):
            with open(path) as f:
                documents = list(yaml.safe_load_all(f))
            found = []
            mapping_keywords(documents, path, found)
            for _, key, value in found:
                checked += 1
                if not isinstance(value, dict):
                    offenders.append("{}: {} is a {}".format(
                        path.relative_to(ANSIBLE_DIR), key, type(value).__name__))
        self.assertGreater(checked, 0, "no vars/args/set_fact/loop_control found; is ANSIBLE_DIR right?")
        self.assertEqual(offenders, [])


if __name__ == "__main__":
    unittest.main()
