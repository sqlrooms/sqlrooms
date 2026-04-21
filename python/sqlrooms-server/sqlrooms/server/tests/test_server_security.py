import pytest

from sqlrooms.server.server import _normalize_target_relation


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("my_table", '"my_table"'),
        ("analytics.events", '"analytics"."events"'),
        ("  users  ", '"users"'),
    ],
)
def test_normalize_target_relation_accepts_safe_identifiers(raw: str, expected: str):
    assert _normalize_target_relation(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "orders; drop table users;--",
        "foo.bar.baz",
        '"quoted"."table"',
        "schema.table where 1=1",
        "table-name",
    ],
)
def test_normalize_target_relation_rejects_unsafe_input(raw: str):
    with pytest.raises(ValueError):
        _normalize_target_relation(raw)
