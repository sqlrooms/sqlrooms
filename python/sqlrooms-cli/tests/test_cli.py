from typer.testing import CliRunner
from sqlrooms.cli import app

runner = CliRunner()

def test_cli_help():
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "Start the SQLRooms local experience" in result.stdout

def test_cli_export_help():
    result = runner.invoke(app, ["export", "--help"])
    assert result.exit_code == 0
    assert "Usage" in result.stdout
    assert "export" in result.stdout
    
# Since the main function in cli.py starts an asyncio loop and a server, 
# unit testing it without mocks is hard. We'll skip deep integration tests 
# of the full server startup here.

