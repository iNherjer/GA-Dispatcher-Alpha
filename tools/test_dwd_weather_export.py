from datetime import datetime, timedelta, timezone
from pathlib import Path
from runpy import run_path
import unittest
from unittest.mock import Mock
from urllib.error import HTTPError


exporter = run_path(str(Path(__file__).with_name("export-dwd-weather-assets.py")))
choose_runs = exporter["choose_runs"]
covers = exporter["covers"]


class ExportPlanningTest(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 11, 23, 19, tzinfo=timezone.utc)
        self.dates = [self.now + timedelta(hours=hour) for hour in range(-3, 31)]
        self.threshold = self.now + timedelta(hours=13)
        self.old_run = self.now - timedelta(hours=7)
        self.new_run = self.now - timedelta(hours=4)
        self.previous = {valid: self.old_run for valid in self.dates}
        self.model = Mock()

    def test_same_run_with_enough_reserve_only_checks_the_ui_window_end(self):
        self.model.choose.return_value = self.old_run
        self.assertIsNone(choose_runs(self.model, self.dates, self.now, self.previous, True))
        self.model.choose.assert_called_once_with(self.threshold)

    def test_extends_the_reserve_before_it_runs_short(self):
        previous = {valid: self.old_run for valid in self.dates[:-10]}
        self.model.choose.return_value = self.old_run
        self.assertTrue(covers(previous, self.now, 3))
        planned = choose_runs(self.model, self.dates, self.now, previous, True)
        self.assertEqual(planned, self.previous)
        self.assertEqual(self.model.choose.call_count, 11)

    def test_newer_run_updates_the_ui_window_and_keeps_the_reserve(self):
        self.model.choose.return_value = self.new_run
        planned = choose_runs(self.model, self.dates, self.now, self.previous, True)
        self.assertEqual(list(planned.values()), [self.old_run] * 3 + [self.new_run] * 14 + [self.old_run] * 17)

    def test_new_reserve_hours_take_the_newest_run_reaching_them(self):
        main_run = self.now - timedelta(hours=13)
        self.model.choose.side_effect = lambda valid: self.new_run if valid <= self.threshold else main_run
        planned = choose_runs(self.model, self.dates, self.now, {}, False)
        self.assertEqual(planned[self.threshold], self.new_run)
        self.assertEqual(planned[self.dates[-1]], main_run)

    def test_delayed_provider_keeps_covered_window_and_fails_if_it_expires(self):
        self.model.choose.side_effect = HTTPError("https://example.org", 404, "Not ready", {}, None)
        self.assertIsNone(choose_runs(self.model, self.dates, self.now, self.previous, True))
        with self.assertRaises(HTTPError):
            choose_runs(self.model, self.dates, self.now, {}, False)


if __name__ == "__main__":
    unittest.main()
