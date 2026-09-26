import pytest

from sqlrooms.server.cache import QueryCache


def test_query_cache_evicts_least_recently_used_entry():
    cache = QueryCache(maxsize=2, stripe_count=4)

    cache["first"] = 1
    cache["second"] = 2
    assert cache.get("first") == 1

    cache["third"] = 3

    assert cache.get("second") is None
    assert cache.get("first") == 1
    assert cache.get("third") == 3


def test_query_cache_uses_fixed_lock_stripes():
    cache = QueryCache(maxsize=1, stripe_count=2)
    stripes = tuple(id(lock) for lock in cache._lock_stripes)

    for index in range(20):
        with cache.lock(f"query-{index}"):
            pass

    assert len(cache._lock_stripes) == 2
    assert tuple(id(lock) for lock in cache._lock_stripes) == stripes
    assert not hasattr(cache, "_locks")


def test_query_cache_rejects_invalid_bounds():
    with pytest.raises(ValueError, match="maxsize"):
        QueryCache(maxsize=0)

    with pytest.raises(ValueError, match="stripe_count"):
        QueryCache(stripe_count=0)
