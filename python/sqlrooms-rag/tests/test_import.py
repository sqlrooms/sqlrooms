"""Basic sanity tests for sqlrooms-rag package."""


def test_basic():
    """Basic sanity test."""
    assert True


def test_python_version():
    """Test that we're using a supported Python version."""
    import sys

    version_info = sys.version_info
    assert version_info.major == 3
    assert version_info.minor >= 10
