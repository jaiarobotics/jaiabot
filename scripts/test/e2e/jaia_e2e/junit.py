"""JUnit XML, so CircleCI renders per-assertion failures rather than one red job."""

import xml.etree.ElementTree as ET

from . import checks as checks_module


def build(checks, elapsed_by_tier=None, suite_prefix='sea-trial'):
    elapsed_by_tier = elapsed_by_tier or {}
    suites = ET.Element('testsuites')
    for tier in checks_module.TIERS:
        in_tier = [c for c in checks if c.tier == tier]
        if not in_tier:
            continue
        failures = sum(1 for c in in_tier if not c.passed)
        suite = ET.SubElement(suites, 'testsuite', {
            'name': f'{suite_prefix}.{tier}',
            'tests': str(len(in_tier)),
            'failures': str(failures),
            'time': f'{elapsed_by_tier.get(tier, 0.0):.3f}',
        })
        for check in in_tier:
            case = ET.SubElement(suite, 'testcase', {
                'classname': f'{suite_prefix}.{tier}',
                'name': check.name,
            })
            if not check.passed:
                failure = ET.SubElement(case, 'failure', {'message': check.detail or 'failed'})
                failure.text = check.detail
            elif check.detail:
                ET.SubElement(case, 'system-out').text = check.detail
    return suites


def write(path, checks, elapsed_by_tier=None, suite_prefix='sea-trial'):
    tree = ET.ElementTree(build(checks, elapsed_by_tier, suite_prefix))
    ET.indent(tree, space='  ')
    tree.write(path, encoding='utf-8', xml_declaration=True)


def summary(checks):
    passed = sum(1 for c in checks if c.passed)
    by_tier = {}
    for tier in checks_module.TIERS:
        in_tier = [c for c in checks if c.tier == tier]
        if in_tier:
            by_tier[tier] = {
                'total': len(in_tier),
                'failed': sum(1 for c in in_tier if not c.passed),
                'failures': [{'name': c.name, 'detail': c.detail}
                             for c in in_tier if not c.passed],
            }
    return {'total': len(checks), 'passed': passed, 'failed': len(checks) - passed,
            'tiers': by_tier,
            'first_failing_tier': next((t for t in checks_module.TIERS
                                        if by_tier.get(t, {}).get('failed')), None)}
