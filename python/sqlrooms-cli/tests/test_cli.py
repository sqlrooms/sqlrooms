from typer.testing import CliRunner
from sqlrooms.cli import app

runner = CliRunner()

def test_cli_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Start the SQLRooms local experience" in result.stdout

def test_cli_version():
    # Typer doesn't automatically add --version unless configured, 
    # but we can check if the app exists.
    assert app.registered_commands == [] # It's a callback-only app in cli.py
    
# Since the main function in cli.py starts an asyncio loop and a server, 
# unit testing it without mocks is hard. We'll skip deep integration tests 
# of the full server startup here.

