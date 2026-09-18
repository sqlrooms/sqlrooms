"""Claude headersHelper: private-file handoff on a dedicated helper stdout pipe."""

import json
import os
from pathlib import Path
import sys
from .security import read_credential_file


def main():
    try:
        record = read_credential_file(Path(os.environ["SQLROOMS_CREDENTIAL_FILE"]))
        endpoint = os.environ.get(
            "CLAUDE_CODE_MCP_SERVER_URL", os.environ.get("SQLROOMS_MCP_URL")
        )
        if endpoint != record["mcpUrl"]:
            raise ValueError("wrong target")
        print(json.dumps({"Authorization": "Bearer " + record["token"]}))
    except Exception:
        print(
            "SQLRooms authentication requires a valid private credential file for this endpoint.",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
