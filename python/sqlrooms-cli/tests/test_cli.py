from typer.testing import CliRunner
from sqlrooms.cli import app

runner = CliRunner()

def test_cli_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Start the SQLRooms local experience" in result.stdout

def test_cli_version():
    # `--version` is not configured; assert expected command registration instead.
    command_names = [command.name for command in app.registered_commands]
    assert "export" in command_names
    
# Since the main function in cli.py starts an asyncio loop and a server, 
# unit testing it without mocks is hard. We'll skip deep integration tests 
# of the full server startup here.

