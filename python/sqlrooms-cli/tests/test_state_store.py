import duckdb
from sqlrooms.web.state_store import DuckDBStateStore

def test_state_store_init(tmp_path):
    db_path = tmp_path / "test.db"
    DuckDBStateStore(db_path)
    
    # Check if schema and tables are created
    with duckdb.connect(str(db_path)) as con:
        tables = con.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = '__sqlrooms'").fetchall()
        table_names = [t[0] for t in tables]
        assert "layout" in table_names
        assert "ai_settings" in table_names
        assert "ai" in table_names
        assert "ai_sessions" in table_names
        assert "ai_messages" in table_names
        assert "sql_editor" in table_names
        assert "sql_editor_queries" in table_names

def test_state_store_save_load(tmp_path):
    db_path = tmp_path / "test.db"
    store = DuckDBStateStore(db_path)
    
    test_state = {
        "layout": {"config": "test"},
        "aiSettings": {"provider": "openai"},
        "ai": {
            "sessions": [
                {
                    "id": "session1",
                    "name": "Test Session",
                    "analysisResults": [
                        {"id": "msg1", "role": "user", "text": "hello"}
                    ]
                }
            ]
        },
        "sqlEditor": {
            "queries": [
                {"id": "q1", "title": "Query 1", "sql": "SELECT 1"}
            ]
        }
    }
    
    store.save_state(test_state)
    loaded_state = store.load_state()
    
    assert loaded_state["layout"] == test_state["layout"]
    assert loaded_state["aiSettings"] == test_state["aiSettings"]
    assert loaded_state["ai"] == test_state["ai"]
    assert loaded_state["sqlEditor"] == test_state["sqlEditor"]

def test_state_store_clear(tmp_path):
    db_path = tmp_path / "test.db"
    store = DuckDBStateStore(db_path)
    
    store.save_state({"layout": {"foo": "bar"}})
    assert "layout" in store.load_state()
    
    store.clear()
    assert store.load_state() == {}

