"""Synthetic oracle regressions; never load or operate a running game session."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from PIL import Image


spec = importlib.util.spec_from_file_location('oracle_under_test', Path(__file__).with_name('oracle.py'))
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)


class OracleComparisonTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='openarcanum-oracle-test-', dir='/tmp')
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.enterContext(patch.object(oracle, 'STATE', self.directory / 'state'))
        # Any accidental process/session operation must fail before reaching the
        # real oracle, even if a future refactor makes compare call another path.
        self.process = self.enterContext(patch.object(oracle.subprocess, 'run', side_effect=AssertionError('No process interaction in comparison tests')))
        self.kill = self.enterContext(patch.object(oracle.os, 'kill', side_effect=AssertionError('No process signals in comparison tests')))

    def image(self, name, size=(4, 4), color=(10, 20, 30), changed=None):
        path = self.directory / name
        with Image.new('RGB', size, color) as image:
            for position, pixel in (changed or {}).items():
                image.putpixel(position, pixel)
            image.save(path)
        return path

    def compare(self, reference, implementation, **options):
        return oracle.compare(SimpleNamespace(reference=reference, implementation=implementation,
            reference_box=options.get('reference_box'), implementation_box=options.get('implementation_box'),
            threshold=options.get('threshold', 8)))

    def cli(self, *arguments):
        output, errors = io.StringIO(), io.StringIO()
        with patch.object(sys, 'argv', ['oracle.py', *map(str, arguments)]), \
                contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
            status = oracle.main()
        return status, output.getvalue(), errors.getvalue()

    def test_identical_pixels_have_zero_difference_and_auditable_artifacts(self):
        reference = self.image('reference.png')
        implementation = self.image('implementation.bmp')
        result = self.compare(reference, implementation)
        self.assertEqual(result['size'], [4, 4])
        self.assertEqual(result['changedPixels'], 0)
        self.assertEqual(result['changedFraction'], 0)
        self.assertEqual(result['meanAbsoluteRGBError'], [0, 0, 0])
        directory = Path(result['output'])
        self.assertTrue(directory.is_relative_to(self.directory))
        self.assertEqual(json.loads((directory / 'comparison.json').read_text()), result)
        with Image.open(directory / 'difference.png') as difference:
            self.assertIsNone(difference.getbbox())
        self.assertEqual(result['referenceSHA256'], oracle.sha(reference))
        self.assertEqual(result['implementationSHA256'], oracle.sha(implementation))

    def test_one_changed_pixel_is_measured_without_mutating_inputs(self):
        reference = self.image('reference.png', color=(0, 0, 0))
        implementation = self.image('implementation.png', color=(0, 0, 0), changed={(2, 1): (20, 40, 80)})
        before = (reference.read_bytes(), implementation.read_bytes())
        result = self.compare(reference, implementation)
        self.assertEqual(result['changedPixels'], 1)
        self.assertEqual(result['changedFraction'], 1 / 16)
        self.assertEqual(result['meanAbsoluteRGBError'], [1.25, 2.5, 5.0])
        with Image.open(Path(result['output']) / 'difference.png') as difference:
            self.assertEqual(difference.getpixel((2, 1)), (20, 40, 80))
            self.assertEqual(difference.getpixel((0, 0)), (0, 0, 0))
        self.assertEqual((reference.read_bytes(), implementation.read_bytes()), before)

    def test_threshold_is_strict_and_does_not_hide_numeric_error(self):
        reference = self.image('reference.png', color=(0, 0, 0))
        implementation = self.image('implementation.png', color=(0, 0, 0), changed={(1, 2): (0, 16, 0)})
        below = self.compare(reference, implementation, threshold=16)
        above = self.compare(reference, implementation, threshold=15)
        self.assertEqual(below['changedPixels'], 0)
        self.assertEqual(above['changedPixels'], 1)
        self.assertEqual(below['meanAbsoluteRGBError'], [0, 1, 0])
        self.assertEqual(above['meanAbsoluteRGBError'], below['meanAbsoluteRGBError'])

    def test_matched_crops_compare_the_same_region_without_rescaling(self):
        reference = self.image('reference.png', size=(8, 7), color=(1, 2, 3))
        implementation = self.image('implementation.png', size=(5, 4), color=(90, 80, 70))
        pattern = [(10, 20, 30), (40, 50, 60), (70, 80, 90),
                   (110, 120, 130), (140, 150, 160), (170, 180, 190)]
        for path, origin in [(reference, (2, 3)), (implementation, (1, 1))]:
            with Image.open(path) as opened:
                image = opened.copy()
            for index, color in enumerate(pattern):
                image.putpixel((origin[0] + index % 3, origin[1] + index // 3), color)
            image.save(path)
            image.close()
        result = self.compare(reference, implementation,
            reference_box=[2, 3, 3, 2], implementation_box=[1, 1, 3, 2])
        self.assertEqual(result['size'], [3, 2])
        self.assertEqual(result['changedPixels'], 0)
        self.assertEqual(result['referenceBox'], [2, 3, 3, 2])
        self.assertEqual(result['implementationBox'], [1, 1, 3, 2])
        with Image.open(Path(result['output']) / 'reference.png') as crop:
            self.assertEqual(crop.size, (3, 2))
            self.assertEqual(crop.getpixel((0, 0)), pattern[0])
            self.assertEqual(crop.getpixel((2, 1)), pattern[-1])

    def test_unequal_sizes_fail_without_comparison_output(self):
        reference = self.image('reference.png', size=(4, 3))
        implementation = self.image('implementation.png', size=(3, 4))
        with self.assertRaisesRegex(ValueError, 'sizes differ.*matched crops'):
            self.compare(reference, implementation)
        self.assertFalse((oracle.STATE / 'comparisons').exists())

    def test_invalid_crops_reject_both_images_before_writing(self):
        reference = self.image('reference.png')
        implementation = self.image('implementation.png')
        invalid = [[-1, 0, 1, 1], [0, -1, 1, 1], [0, 0, 0, 1],
                   [0, 0, 1, 0], [3, 0, 2, 1], [0, 3, 1, 2]]
        for name in ('reference', 'implementation'):
            for box in invalid:
                with self.subTest(image=name, box=box), self.assertRaisesRegex(ValueError, f'Invalid {name} crop'):
                    self.compare(reference, implementation, **{name + '_box': box})
        self.assertFalse((oracle.STATE / 'comparisons').exists())

    def test_compare_cli_emits_json_and_reports_invalid_crop(self):
        reference = self.image('reference.png')
        implementation = self.image('implementation.png')
        status, output, errors = self.cli('compare', reference, implementation, '--threshold', '0')
        self.assertEqual(status, 0)
        self.assertNotIn('Oracle:', errors)
        self.assertEqual(json.loads(output)['changedPixels'], 0)
        status, output, errors = self.cli('compare', reference, implementation, '--reference-box', '-1', '0', '1', '1')
        self.assertEqual(status, 1)
        self.assertEqual(output, '')
        self.assertIn('Invalid reference crop', errors)

    def test_compare_cli_rejects_invalid_threshold(self):
        reference = self.image('reference.png')
        implementation = self.image('implementation.png')
        for threshold in ('-1', '256', 'not-an-integer'):
            with self.subTest(threshold=threshold), self.assertRaises(SystemExit) as raised:
                self.cli('compare', reference, implementation, '--threshold', threshold)
            self.assertEqual(raised.exception.code, 2)
        self.assertFalse((oracle.STATE / 'comparisons').exists())


class OracleProcessIdentityTests(unittest.TestCase):
    def test_reused_pid_is_not_an_owned_oracle_display(self):
        identity = dict(started='1000', uid=os.getuid(), arguments=['Xvfb', ':99', '-nolisten', 'tcp'])
        state = dict(xvfbPid=12345, xvfbIdentity=identity)
        with patch.object(oracle, 'process_identity', return_value=identity):
            self.assertTrue(oracle.owned_display(state))
        # Reused PID and identical command/UID are insufficient: the process's
        # kernel start time must still match the originally recorded instance.
        replacement = {**identity, 'started': '2000'}
        with patch.object(oracle, 'process_identity', return_value=replacement) as lookup:
            self.assertFalse(oracle.owned_display(state))
            lookup.assert_called_once_with(12345)
            with patch.object(oracle, 'load_state', return_value=state), \
                    self.assertRaisesRegex(RuntimeError, 'no longer running'):
                oracle.run_state()
        for current in (None, {**identity, 'uid': os.getuid() + 1}, {**identity, 'arguments': ['unrelated']}):
            with self.subTest(current=current), patch.object(oracle, 'process_identity', return_value=current):
                self.assertFalse(oracle.owned_display(state))


class OracleLifecycleTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='openarcanum-oracle-test-', dir='/tmp')
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        for name, path in [('STATE', self.directory / 'state'),
                           ('GAME', self.directory / 'state/game'),
                           ('PREFIX', self.directory / 'wineprefix')]:
            self.enterContext(patch.object(oracle, name, path))
        oracle.STATE.mkdir()
        self.process = self.enterContext(patch.object(oracle.subprocess, 'run',
            side_effect=AssertionError('No real process interaction in lifecycle tests')))
        self.kill = self.enterContext(patch.object(oracle.os, 'kill',
            side_effect=AssertionError('No real process signals in lifecycle tests')))

    def test_stop_after_display_exit_stops_scoped_wine_and_clears_session(self):
        state = dict(display=':99', authority=str(self.directory / 'Xauthority'),
                     xvfbPid=12345, xvfbIdentity=dict(started='1000', uid=os.getuid(), arguments=['Xvfb']))
        oracle.save(oracle.STATE / 'session.json', state)
        self.process.side_effect = None
        with patch.object(oracle, 'process_identity', return_value=None) as identity:
            result = oracle.stop(None)
        self.assertEqual([call.args[0] for call in self.process.call_args_list], [
            [str(oracle.SCRIPTS / 'wine.sh'), '--server', '-k'],
            [str(oracle.SCRIPTS / 'wine.sh'), '--server', '-w']])
        for call in self.process.call_args_list:
            self.assertTrue(call.kwargs['check'])
            self.assertEqual(call.kwargs['env']['WINEPREFIX'], str(oracle.PREFIX))
            self.assertEqual(call.kwargs['env']['DISPLAY'], state['display'])
            self.assertEqual(call.kwargs['env']['XAUTHORITY'], state['authority'])
        identity.assert_called_once_with(state['xvfbPid'])
        self.kill.assert_not_called()
        self.assertFalse((oracle.STATE / 'session.json').exists())
        previous = json.loads((oracle.STATE / 'last-session.json').read_text())
        self.assertEqual(previous, {**state, 'stoppedAt': result['stoppedAt']})
        self.assertTrue(result['ok'])
        self.assertTrue(result['stoppedAt'])

    def test_ghidra_reuses_valid_timestamped_retry_after_incomplete_base(self):
        oracle.GAME.mkdir()
        executable = oracle.GAME / 'Arcanum.exe'
        executable.write_bytes(b'Synthetic executable identity; never executed')
        digest = oracle.sha(executable)
        name, project = 'Arcanum-' + digest[:12], 'Arcanum-' + digest[:12]
        projects = oracle.STATE / 'ghidra-projects'
        projects.mkdir()
        # A newer failed attempt must not hide a successful retry. Each case
        # lacks a different requirement: usable decompilation, matching identity,
        # or its corresponding persistent Ghidra project.
        attempts = [('', digest, True, False),
                    ('-20261012T120000000000Z', digest, True, True),
                    ('-20261012T130000000000Z', 'wrong-digest', True, True),
                    ('-20261012T140000000000Z', digest, False, True)]
        for suffix, report_digest, has_project, has_file in attempts:
            output = oracle.STATE / 'analysis' / (name + suffix)
            summary = dict(sha256=report_digest, functions=1,
                           entryPoints=[dict(decompiled=True, file='entry.c')])
            oracle.save(output / 'program-summary.json', summary)
            if has_project:
                (projects / (project + suffix + '.gpr')).write_text('Synthetic project')
            if has_file:
                (output / 'entry.c').write_text('void synthetic_entry(void) {}\n')
        retry = oracle.STATE / 'analysis' / (name + attempts[1][0])
        before = sorted(str(path.relative_to(self.directory)) for path in self.directory.rglob('*'))
        result = oracle.ghidra(SimpleNamespace(exe=executable.name))
        self.assertTrue(result['reused'])
        self.assertEqual(result['output'], str(retry))
        self.assertEqual(result['project'], str(projects / (project + attempts[1][0] + '.gpr')))
        self.assertEqual(result['summary'], json.loads((retry / 'program-summary.json').read_text()))
        self.assertEqual(sorted(str(path.relative_to(self.directory)) for path in self.directory.rglob('*')), before)
        self.process.assert_not_called()
        self.kill.assert_not_called()


if __name__ == '__main__':
    unittest.main()
