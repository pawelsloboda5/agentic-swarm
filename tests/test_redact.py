"""Tests for the shared secret-redactor (redact.py).

The redactor is the spine of the privacy guarantee: every string written by the
profiler passes through scrub_text/scrub_obj. These tests prove it masks each
known secret SHAPE and collapses home paths.

IMPORTANT: no complete secret-shaped literal appears in this file. Every sample is
ASSEMBLED AT RUNTIME from fragments (see CONTRIBUTING.md, "no literal secrets")
so the suite can't itself trip a secret scanner. test_no_literal_secrets.py
enforces that convention across the whole repo.
"""
import json
import os

import redact

# 36-char filler that matches [A-Za-z0-9]; never a token on its own.
_F = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

# name -> a secret-SHAPED string, assembled so no literal token sits in source.
SECRET_SHAPES = {
    "anthropic_key": "sk-" + "ant-api03-" + _F,
    "openai_key": "sk-" + _F,
    "openai_proj_key": "sk-" + "proj-" + _F,
    "github_token": "ghp" + "_" + _F,
    "github_pat": "github" + "_pat_" + _F,
    "npm_token": "npm" + "_" + (_F + _F)[:40],
    "google_key": "AIza" + _F,
    "aws_akid": "AKIA" + "ABCDEFGHIJ123456",  # AKIA + exactly 16 [0-9A-Z]
    "slack_token": "xoxb" + "-" + (_F + _F)[:20],
    "stripe_key": "sk" + "_live_" + _F,
    "jwt": ".".join(("eyJ" + _F, "eyJ" + _F, _F[:12])),
    "hex_secret": "a1b2c3d4" * 6,  # 48 hex chars (>= 40)
    "bearer": "Bearer " + _F,
}


def test_each_secret_shape_is_masked():
    for name, secret in SECRET_SHAPES.items():
        out = redact.scrub_text("prefix " + secret + " suffix")
        assert secret not in out, "{0} leaked: {1!r}".format(name, out)
        assert "[REDACTED]" in out, "{0} not masked: {1!r}".format(name, out)
        # surrounding non-secret text is preserved
        assert out.startswith("prefix ") and out.endswith(" suffix")


def test_private_key_block_collapsed():
    block = (
        "-----BEGIN RSA PRIVATE KEY-----\n"
        + "\n".join([_F] * 4)
        + "\n-----END RSA PRIVATE KEY-----"
    )
    out = redact.scrub_text("before " + block + " after")
    assert "PRIVATE KEY" not in out
    assert "[REDACTED]" in out
    assert out.startswith("before ") and out.endswith(" after")


def test_assignment_masks_value_keeps_key():
    value = "z" * 20
    out = redact.scrub_text("password = '" + value + "'")
    assert value not in out
    assert "password" in out  # key name kept for readability
    assert "[REDACTED]" in out


def test_email_masked():
    out = redact.scrub_text("contact " + "user" + "@" + "example.com" + " now")
    assert "@example.com" not in out
    assert "[REDACTED_EMAIL]" in out


def test_generic_home_paths_collapsed():
    # These do not depend on the running user's home — they exercise the generic
    # fallback patterns for Windows / macOS / Linux / Git-Bash home roots.
    assert redact.scrub_text("/home/alice/project") == "~/project"
    assert redact.scrub_text("/Users/bob/x") == "~/x"
    gitbash = redact.scrub_text("/c/Users/Carol/y")
    assert "Carol" not in gitbash and "~" in gitbash
    win = redact.scrub_text("C:\\Users\\Dave\\Desktop")
    assert "Dave" not in win and "~" in win


def test_running_user_home_collapsed():
    home = os.path.expanduser("~")
    out = redact.scrub_text(os.path.join(home, "my_proj"))
    assert home not in out
    assert "~" in out


def test_running_user_slug_collapsed():
    # Claude Code's "project slug" form: every non-alnum char in the cwd -> '-'.
    home = os.path.expanduser("~")
    slug = redact.slugify(home)
    out = redact.scrub_text(slug + "-Desktop-my_proj")
    assert slug not in out
    assert "~" in out


def test_scrub_obj_recurses_values_and_keys():
    secret = "ghp" + "_" + _F
    obj = {"a": {"b": [secret, {"c": secret}]}, "n": 5, "keep": "react"}
    out = redact.scrub_obj(obj)
    blob = json.dumps(out)
    assert secret not in blob
    assert out["n"] == 5
    assert out["keep"] == "react"
    # secret-bearing KEY is scrubbed too
    out2 = redact.scrub_obj({secret: "v"})
    assert secret not in json.dumps(out2)


def test_non_string_values_pass_through():
    assert redact.scrub_text(123) == 123
    assert redact.scrub_text(None) is None
    assert redact.scrub_text(True) is True
    assert redact.scrub_obj({"x": 1, "y": [2, 3.5, True, None]}) == {
        "x": 1,
        "y": [2, 3.5, True, None],
    }


def test_benign_text_is_not_mangled():
    for s in ["react", "import os", "def main():", "hello world", "Next.js app"]:
        assert redact.scrub_text(s) == s
