import threading
from concurrent.futures import ThreadPoolExecutor

import pytest

from sqlrooms.server.cache import QueryCache


def test_unrelated_query_locks_do_not_block_on_hash_collisions():
    class CollidingKey(str):
        def __hash__(self):
            return 0

    cache = QueryCache()
    completed = threading.Event()

    def unrelated_query():
        with cache.lock(CollidingKey("short-query")):
            completed.set()

    # A long query must not keep another connection from receiving its short
    # query result and then cancelling the long query, even on a hash collision.
    with ThreadPoolExecutor(max_workers=1) as executor:
        with cache.lock(CollidingKey("long-query")):
            future = executor.submit(unrelated_query)
            progressed = completed.wait(2)
        future.result(timeout=2)
    assert progressed


def test_query_cache_evicts_least_recently_used_entry():
    cache = QueryCache(maxsize=2)

    cache["first"] = 1
    cache["second"] = 2
    assert cache.get("first") == 1

    cache["third"] = 3

    assert cache.get("second") is None
    assert cache.get("first") == 1
    assert cache.get("third") == 3


def test_query_locks_are_reentrant_and_release_idle_keys_after_errors():
    cache = QueryCache(maxsize=1)
    for index in range(100):
        with pytest.raises(ValueError, match="query failed"):
            with cache.lock(f"query-{index}"):
                with cache.lock(f"query-{index}"):
                    assert len(cache._locks) == 1
                    raise ValueError("query failed")
        assert not cache._locks


def test_same_query_waits_for_its_current_holder():
    cache = QueryCache()
    started, entered = threading.Event(), threading.Event()

    def waiter():
        started.set()
        with cache.lock("same"):
            entered.set()

    with ThreadPoolExecutor(max_workers=1) as executor:
        with cache.lock("same"):
            future = executor.submit(waiter)
            assert started.wait(2)
            assert not entered.wait(0.05)
        future.result(timeout=2)
    assert entered.is_set()
    assert not cache._locks


def test_query_cache_rejects_invalid_bounds():
    with pytest.raises(ValueError, match="maxsize"):
        QueryCache(maxsize=0)
