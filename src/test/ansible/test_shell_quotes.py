"""An odd number of apostrophes in a shell block stops a major upgrade.

The argument splitter in ansible-core 2.16.3 - what Ubuntu 24.04, and so a 2.y hub,
ships - reads every ' in a free-form module argument as a quote. An odd count is an
unbalanced quote and the play fails to load:

    ERROR! failed at splitting arguments, either an unbalanced jinja2 block or quotes

A major upgrade is driven from a hub still running the release being left behind, so
that is the parser every upgrade goes through, and the include sits after the play has
stopped jaiabot. Newer ansible accepts it, so nothing on a current controller notices,
and neither --syntax-check nor --list-tasks does either, because the task files arrive
through include_tasks. Hence a check on the text itself.
"""

import pathlib
import unittest

import yaml

FREE_FORM_MODULES = ("shell", "command", "raw", "script")
ANSIBLE_DIR = pathlib.Path(__file__).resolve().parents[3] / "config" / "ansible"


def shell_blocks(node, path, found):
    if isinstance(node, list):
        for item in node:
            shell_blocks(item, path, found)
    elif isinstance(node, dict):
        for key, value in node.items():
            if key in FREE_FORM_MODULES and isinstance(value, str):
                found.append((path, key, value))
            else:
                shell_blocks(value, path, found)


class TestShellQuotes(unittest.TestCase):
    def test_apostrophes_are_balanced(self):
        offenders = []
        blocks = 0

        for playbook in sorted(ANSIBLE_DIR.rglob("*.yml")):
            for document in yaml.safe_load_all(playbook.read_text()):
                found = []
                shell_blocks(document, playbook, found)
                for path, key, text in found:
                    blocks += 1
                    if text.count("'") % 2:
                        offenders.append(f"{path.relative_to(ANSIBLE_DIR.parent.parent)} [{key}]")

        self.assertTrue(blocks, f"found no shell blocks under {ANSIBLE_DIR}")
        self.assertEqual(
            offenders,
            [],
            "odd number of apostrophes in a shell block, which ansible-core 2.16.3 "
            "reads as an unbalanced quote and refuses to load:\n  "
            + "\n  ".join(offenders)
            + "\nReword the comment, or pair the quote.",
        )


if __name__ == "__main__":
    unittest.main()
