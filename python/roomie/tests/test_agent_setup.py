"""Setup entry points prompt only in a terminal and preserve explicit previews."""

import json
from pathlib import Path
import sys

import pytest

from roomie.agent import main
from roomie.setup import configure


def terminal(monkeypatch, answers):
    monkeypatch.setattr(sys.stdin, "isatty", lambda: True)
    monkeypatch.setattr(sys.stdout, "isatty", lambda: True)
    replies = iter(answers)
    monkeypatch.setattr("builtins.input", lambda _: next(replies))


@pytest.mark.parametrize("choice,client", [("1", "claude-code"), ("2", "codex")])
def test_interactive_apply_installs_selected_client(
    choice, client, monkeypatch, capsys
):
    terminal(monkeypatch, [choice, "yes"])
    monkeypatch.setattr("roomie.setup.shutil.which", lambda _: "/test/host")
    plan = configure(client)
    main(["setup"])
    assert Path(plan["configurationPath"]).is_file()
    if client == "codex":
        assert Path(plan["guidancePath"]).is_file()
    output = capsys.readouterr().out
    assert "Proposed configuration (not yet applied)" in output
    assert "Launch command:" in output
    assert ("--plugin-dir" if client == "claude-code" else "codex") in output


@pytest.mark.parametrize("answer", ["", "n", "no", "anything"])
def test_declining_preview_does_not_write(monkeypatch, capsys, answer):
    terminal(monkeypatch, ["2", answer])
    plan = configure("codex")
    main(["setup"])
    assert not Path(plan["configurationPath"]).exists()
    assert not Path(plan["guidancePath"]).exists()
    assert "No changes made" in capsys.readouterr().out


def test_manual_setup_reprompts_invalid_choice_and_does_not_write(monkeypatch, capsys):
    terminal(monkeypatch, ["invalid", "3"])
    before = list(Path.home().rglob("*"))
    main(["setup"])
    output = capsys.readouterr().out
    assert "Enter 1, 2, or 3" in output
    assert "stdio" in output
    assert json.dumps(sys.executable) in output
    assert '"connect"' in output
    assert "SKILL.md" in output
    assert "agent's instructions" in output
    assert list(Path.home().rglob("*")) == before


def test_empty_choice_cancels(monkeypatch, capsys):
    terminal(monkeypatch, [""])
    main(["setup"])
    assert "Setup cancelled" in capsys.readouterr().out
    assert not list(Path.home().rglob("*"))


@pytest.mark.parametrize("error", [EOFError, KeyboardInterrupt])
@pytest.mark.parametrize("at_confirmation", [False, True])
def test_interrupted_prompt_does_not_write(monkeypatch, capsys, error, at_confirmation):
    terminal(monkeypatch, [])
    calls = []

    def interrupt(_):
        if at_confirmation and not calls:
            calls.append(True)
            return "2"
        raise error

    monkeypatch.setattr("builtins.input", interrupt)
    with pytest.raises(SystemExit) as exc:
        main(["setup"])
    assert exc.value.code == 130
    assert "Setup cancelled" in capsys.readouterr().err
    assert not list(Path.home().rglob("*"))


@pytest.mark.parametrize(
    "stdin_tty,stdout_tty", [(False, False), (False, True), (True, False)]
)
def test_noninteractive_setup_prints_help_without_prompting(
    monkeypatch, capsys, stdin_tty, stdout_tty
):
    terminal(monkeypatch, [])  # Any unexpected input call fails the test.
    monkeypatch.setattr(sys.stdin, "isatty", lambda: stdin_tty)
    monkeypatch.setattr(sys.stdout, "isatty", lambda: stdout_tty)
    main(["setup"])
    output = capsys.readouterr().out
    assert "--client {claude-code,codex}" in output
    assert "stdio" in output
    assert "SKILL.md" in output
    assert not list(Path.home().rglob("*"))


@pytest.mark.parametrize("client", ["claude-code", "codex"])
def test_explicit_client_stays_json_preview_even_in_terminal(
    monkeypatch, capsys, client
):
    terminal(monkeypatch, [])
    main(["setup", "--client", client])
    plan = json.loads(capsys.readouterr().out)
    assert plan["applied"] is False
    assert not Path(plan["configurationPath"]).exists()


def test_explicit_apply_does_not_prompt(monkeypatch, capsys):
    terminal(monkeypatch, [])
    monkeypatch.setattr("roomie.setup.shutil.which", lambda _: "/test/host")
    main(["setup", "--client", "codex", "--apply"])
    plan = json.loads(capsys.readouterr().out)
    assert plan["applied"] is True
    assert Path(plan["configurationPath"]).is_file()


def test_apply_requires_client(monkeypatch, capsys):
    terminal(monkeypatch, [])
    with pytest.raises(SystemExit) as exc:
        main(["setup", "--apply"])
    assert exc.value.code == 2
    assert "--apply requires --client" in capsys.readouterr().err
    assert not list(Path.home().rglob("*"))


def test_setup_error_is_reported_without_traceback(monkeypatch, capsys):
    terminal(monkeypatch, ["2", "y"])
    monkeypatch.setattr("roomie.setup.shutil.which", lambda _: None)
    with pytest.raises(SystemExit) as exc:
        main(["setup"])
    assert exc.value.code == 1
    assert json.loads(capsys.readouterr().err)["code"] == "client_missing"
    assert not list(Path.home().rglob("*"))


def test_generic_is_not_a_client(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["setup", "--client", "generic"])
    assert exc.value.code == 2
    assert "invalid choice" in capsys.readouterr().err
