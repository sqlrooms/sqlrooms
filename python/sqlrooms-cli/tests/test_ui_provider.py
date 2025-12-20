from sqlrooms.web.ui import BuiltinUiProvider, DirectoryUiProvider

def test_builtin_ui_provider():
    provider = BuiltinUiProvider()
    assert "sqlrooms" in str(provider.static_dir())
    assert provider.index_html() == provider.static_dir() / "index.html"

def test_directory_ui_provider(tmp_path):
    custom_dir = tmp_path / "my-ui"
    custom_dir.mkdir()
    provider = DirectoryUiProvider(custom_dir)
    assert provider.static_dir() == custom_dir.resolve()
    assert provider.index_html() == custom_dir.resolve() / "index.html"

