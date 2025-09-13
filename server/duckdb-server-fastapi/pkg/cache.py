import logging
from hashlib import sha256

logger = logging.getLogger(__name__)


def get_key(sql: str, command: str) -> str:
    """Generate a deterministic cache key from SQL text and a logical command scope."""
    return f"{sha256(sql.encode('utf-8')).hexdigest()}.{command}"


def retrieve(cache, query, get):
    """
    Retrieve a cached value for a query or compute and optionally persist it.

    - cache: a dict-like cache
    - query: expects keys 'sql', 'type', and optional 'persist' (bool)
    - get: callable taking (sql) -> result
    """
    sql = query.get("sql")
    command = query.get("type")

    key = get_key(sql, command)
    result = cache.get(key)

    if result:
        logger.debug("Cache hit")
        return result
    else:
        try:
            result = get(sql)
            if query.get("persist", False):
                cache[key] = result
            return result
        except Exception as e:
            logger.error(f"Error retrieving data: {str(e)}")
            raise


def retrieve_by_key(cache, key: str, get, persist: bool = True):
    """
    Generic retrieval by explicit key. Useful for non-SQL callers.
    - cache: dict-like cache
    - key: precomputed cache key string
    - get: zero-arg callable to compute value
    - persist: whether to store computed value in cache
    """
    if cache is None:
        return get()

    result = cache.get(key)
    if result is not None:
        logger.debug("Cache hit")
        return result
    value = get()
    if persist:
        cache[key] = value
    return value


