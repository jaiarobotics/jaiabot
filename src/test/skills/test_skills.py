#!/usr/bin/env python3

"""The Claude Code skills in .claude/skills stay loadable and self-consistent.

A skill is read by Claude Code, not built, so nothing else notices a SKILL.md that
lost its frontmatter or a script it tells Claude to run that was renamed.
"""

import os
import pathlib
import re
import subprocess
import unittest

SKILLS_DIR = pathlib.Path(__file__).resolve().parents[3] / ".claude" / "skills"


def skills():
    return sorted(p.parent for p in SKILLS_DIR.glob("*/SKILL.md"))


def frontmatter(skill):
    text = (skill / "SKILL.md").read_text()
    found = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
    return dict(re.findall(r"^(\w+): *(.+)$", found.group(1), re.MULTILINE)) if found else None


class SkillsTest(unittest.TestCase):
    def test_there_are_skills(self):
        self.assertTrue(skills(), "no SKILL.md under {}".format(SKILLS_DIR))

    def test_each_skill_has_a_name_matching_its_directory_and_a_description(self):
        for skill in skills():
            meta = frontmatter(skill)
            self.assertIsNotNone(meta, "{}: SKILL.md has no frontmatter".format(skill.name))
            self.assertEqual(meta.get("name"), skill.name)
            self.assertGreater(len(meta.get("description", "")), 40, skill.name)

    def test_every_file_a_skill_mentions_exists(self):
        for skill in skills():
            text = (skill / "SKILL.md").read_text()
            for ref in sorted(set(re.findall(r"\b((?:scripts|references)/[\w./-]+\.\w+)", text))):
                self.assertTrue((skill / ref).exists(), "{}: {} is mentioned but missing".format(skill.name, ref))

    def test_every_script_is_executable_and_parses(self):
        for skill in skills():
            for script in sorted((skill / "scripts").glob("*.sh")):
                self.assertTrue(os.access(script, os.X_OK), "{} is not executable".format(script.name))
                result = subprocess.run(["bash", "-n", str(script)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, "{}: {}".format(script.name, result.stderr))

    def test_every_script_explains_itself_when_called_wrongly(self):
        for skill in skills():
            for script in sorted((skill / "scripts").glob("*.sh")):
                result = subprocess.run(["bash", str(script)], capture_output=True, text=True, timeout=30)
                self.assertNotEqual(result.returncode, 0, script.name)
                self.assertIn("Usage", result.stdout + result.stderr, script.name)


if __name__ == "__main__":
    unittest.main()
