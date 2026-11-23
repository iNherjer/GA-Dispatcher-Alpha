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
        self.dates = [self.now + timedelta(hours=hour) for hour in range(-3, 17)]
        self.old_run = self.now - timedelta(hours=7)
        self.new_run = self.now - timedelta(hours=4)
        self.previous = {valid: self.old_run for valid in self.dates}
        self.model = Mock()

    def test_same_run_only_checks_the_last_hour_when_next_hour_is_covered(self):
        self.model.choose.return_value = self.old_run
        self.assertIsNone(choose_runs(self.model, self.dates, self.now, self.previous, True))
        self.model.choose.assert_called_once_with(self.dates[-1])

    def test_extends_current_run_before_the_window_expires(self):
        previous = {valid: self.old_run for valid in self.dates[:-4]}
        self.model.choose.return_value = self.old_run
        self.assertTrue(covers(previous, self.now, 3))
        planned = choose_runs(self.model, self.dates, self.now, previous, True)
        self.assertEqual(planned, self.previous)

    def test_newer_run_reuses_history_and_updates_future(self):
        self.model.choose.return_value = self.new_run
        planned = choose_runs(self.model, self.dates, self.now, self.previous, True)
        self.assertEqual(list(planned.values()), [self.old_run] * 3 + [self.new_run] * 17)

    def test_delayed_provider_keeps_covered_window_and_fails_if_it_expires(self):
        self.model.choose.side_effect = HTTPError("https://example.org", 404, "Not ready", {}, None)
        self.assertIsNone(choose_runs(self.model, self.dates, self.now, self.previous, True))
        with self.assertRaises(HTTPError):
            choose_runs(self.model, self.dates, self.now, {}, False)


if __name__ == "__main__":
    unittest.main()
