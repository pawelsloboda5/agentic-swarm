"""Shared pytest setup.

The profiler scripts live under skills/as-new-project/scripts/ and are written to
be run directly (each does `sys.path.insert(0, <its dir>); import redact`). They are
not a pip package, so we put that directory on sys.path here to import them as
modules under test.
"""
import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SCRIPTS = os.path.join(_REPO_ROOT, "skills", "as-new-project", "scripts")
if _SCRIPTS not in sys.path:
    sys.path.insert(0, _SCRIPTS)

# The gate helper scripts (WCAG contrast util, etc.) live under the architect skill's gates/lib/
# and are run directly / imported as modules under test, so put that dir on sys.path too.
_GATES_LIB = os.path.join(_REPO_ROOT, "skills", "architect", "gates", "lib")
if _GATES_LIB not in sys.path:
    sys.path.insert(0, _GATES_LIB)
