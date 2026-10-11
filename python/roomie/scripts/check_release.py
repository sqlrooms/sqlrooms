"""Publication preflight; never upload or configure release credentials."""

import json
from urllib.request import urlopen

# This stack uses new shared APIs. Publishing requires a release owner to verify
# that the selected upstream release actually includes this adapter boundary.
with urlopen("https://pypi.org/pypi/sqlrooms/0.1.6/json", timeout=15) as response:
    release = json.load(response)
assert release["info"]["version"] == "0.1.6"
assert any(
    file["filename"].endswith(".whl") and not file.get("yanked")
    for file in release["urls"]
)
print(
    "SQLRooms 0.1.6 is available. Before upload, verify its adapter compatibility and the authorized roomie PyPI owner."
)
