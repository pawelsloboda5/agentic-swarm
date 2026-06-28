"""Unit tests for the zero-dep WCAG-contrast util (skills/architect/gates/lib/wcag_contrast.py).

The formula is the fixed W3C standard, so the anchor vectors are exact (black-on-white = 21:1,
white-on-white = 1:1). The grey boundary (#767676 on white is the canonical darkest grey that passes
AA normal text) is asserted as a tight range to avoid pinning a hand-computed constant too precisely.
"""
import pytest

import wcag_contrast as w


def test_black_on_white_is_21():
    assert round(w.ratio("#000000", "#ffffff"), 2) == 21.0


def test_white_on_white_is_1():
    assert round(w.ratio("#ffffff", "#ffffff"), 2) == 1.0


def test_symmetric():
    assert w.ratio("#123456", "#abcdef") == w.ratio("#abcdef", "#123456")


def test_three_digit_hex_expands():
    assert w.ratio("#000", "#fff") == w.ratio("#000000", "#ffffff")


def test_passes_aa_normal_boundary_grey():
    # #767676 on white ~= 4.54 — the canonical darkest grey that passes AA normal text.
    r = w.ratio("#767676", "#ffffff")
    assert 4.5 <= r <= 4.6
    assert w.passes(r, "normal")


def test_normal_threshold_is_4_5():
    assert w.passes(4.5, "normal")
    assert not w.passes(4.49, "normal")


def test_large_threshold_is_3():
    assert w.passes(3.0, "large")
    assert not w.passes(2.99, "large")


def test_ui_threshold_is_3():
    assert w.passes(3.0, "ui")
    assert not w.passes(2.99, "ui")


def test_rejects_bad_hex():
    with pytest.raises(ValueError):
        w.ratio("#xyz", "#ffffff")
    with pytest.raises(ValueError):
        w.ratio("not-a-color", "#ffffff")


def test_rejects_unknown_size():
    with pytest.raises(ValueError):
        w.passes(10.0, "enormous")
