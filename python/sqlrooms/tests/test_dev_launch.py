"""Development launch uses native authority without bypassing page bootstrap."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

import pytest


@pytest.fixture
def dev_launch(monkeypatch):
    path = Path(__file__).parents[1] / "scripts/open_dev.py"
    spec = importlib.util.spec_from_file_location("open_dev", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    response = SimpleNamespace(
        raise_for_status=lambda: None, json=lambda: {"binding": "current"}
    )
    client = Mock()
    client.__enter__ = Mock(return_value=client)
    client.__exit__ = Mock(return_value=False)
    client.get.return_value = response
    monkeypatch.setattr(module.httpx, "Client", Mock(return_value=client))
    monkeypatch.setattr(module.registry, "verify", Mock())
    monkeypatch.setattr(
        module.registry,
        "request",
        Mock(return_value={"url": "http://localhost:3100/#sqlrooms-ticket=once"}),
    )
    monkeypatch.setattr(module.webbrowser, "open_new_tab", Mock(return_value=True))
    monkeypatch.setattr(module.sys.stderr, "isatty", lambda: False)
    return module


def test_dev_launch_targets_exact_backend_and_keeps_ticket_out_of_logs(
    dev_launch, monkeypatch, capsys
):
    expected = {"instanceId": "current", "apiUrl": "http://127.0.0.1:4273"}
    monkeypatch.setattr(
        dev_launch.registry,
        "records",
        lambda: [
            {"instanceId": "other", "apiUrl": expected["apiUrl"]},
            expected,
        ],
    )
    dev_launch.launch_dev(expected["apiUrl"])
    dev_launch.registry.verify.assert_called_once_with(expected)
    dev_launch.registry.request.assert_called_once_with(
        expected, "/api/auth/ticket", payload={}
    )
    dev_launch.webbrowser.open_new_tab.assert_called_once_with(
        "http://localhost:3100/#sqlrooms-ticket=once"
    )
    assert "once" not in capsys.readouterr().err


@pytest.mark.parametrize(
    "record",
    [
        {"instanceId": "old", "apiUrl": "http://127.0.0.1:4273"},
        {"instanceId": "current", "apiUrl": "http://127.0.0.1:4274"},
    ],
)
def test_dev_launch_never_targets_other_binding_or_port(
    dev_launch, monkeypatch, record
):
    monkeypatch.setattr(dev_launch.registry, "records", lambda: [record])
    with pytest.raises(RuntimeError, match="native handoff"):
        dev_launch.launch_dev("http://127.0.0.1:4273", timeout=0)
    dev_launch.registry.request.assert_not_called()
    dev_launch.webbrowser.open_new_tab.assert_not_called()


def test_no_open_browser_prints_only_to_interactive_terminal(
    dev_launch, monkeypatch, capsys
):
    record = {"instanceId": "current", "apiUrl": "http://127.0.0.1:4273"}
    monkeypatch.setattr(dev_launch.registry, "records", lambda: [record])
    monkeypatch.setattr(dev_launch.sys.stderr, "isatty", lambda: True)
    dev_launch.launch_dev(record["apiUrl"], open_browser=False)
    assert "#sqlrooms-ticket=once" in capsys.readouterr().err
    dev_launch.webbrowser.open_new_tab.assert_not_called()


def test_automatic_browser_and_terminal_receive_separate_tickets(
    dev_launch, monkeypatch, capsys
):
    record = {"instanceId": "current", "apiUrl": "http://127.0.0.1:4273"}
    monkeypatch.setattr(dev_launch.registry, "records", lambda: [record])
    monkeypatch.setattr(dev_launch.sys.stderr, "isatty", lambda: True)
    dev_launch.registry.request.side_effect = [
        {"url": "http://localhost:3100/#sqlrooms-ticket=browser"},
        {"url": "http://localhost:3100/#sqlrooms-ticket=terminal"},
    ]
    dev_launch.launch_dev(record["apiUrl"])
    dev_launch.webbrowser.open_new_tab.assert_called_once_with(
        "http://localhost:3100/#sqlrooms-ticket=browser"
    )
    output = capsys.readouterr().err
    assert "#sqlrooms-ticket=terminal" in output
    assert "#sqlrooms-ticket=browser" not in output
