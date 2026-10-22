"""Compatibility entry point for exporting only the onboarding page."""

from pathlib import Path
import runpy


if __name__ == "__main__":
    workflow = runpy.run_path(str(Path(__file__).with_name("export-info-pages.py")))
    workflow["export_page"]("onboarding.html", "VFR-Multitool-Onboarding.html")
