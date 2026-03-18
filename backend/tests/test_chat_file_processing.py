"""Tests for file processing helpers in api/chat.py."""
import pytest
import base64
from unittest.mock import MagicMock, patch
from io import BytesIO

from api.chat import _process_uploaded_files, _extract_pdf_text


def _make_file(filename, content=b"hello", content_type="text/plain"):
    """Create a mock file object matching Flask's FileStorage interface."""
    mock = MagicMock()
    mock.filename = filename
    mock.content_type = content_type
    mock.read.return_value = content
    return mock


class TestExtractPdfText:
    def test_valid_pdf(self):
        """Test with a minimal valid PDF."""
        # Create a simple PDF using PyPDF2
        try:
            from PyPDF2 import PdfWriter
            writer = PdfWriter()
            writer.add_blank_page(width=72, height=72)
            buf = BytesIO()
            writer.write(buf)
            # Blank pages extract empty text, so result is empty string
            result = _extract_pdf_text(buf.getvalue())
            assert isinstance(result, str)
        except ImportError:
            pytest.skip("PyPDF2 not installed")

    def test_corrupted_pdf_returns_empty(self):
        result = _extract_pdf_text(b"not a real pdf")
        assert result == ""

    def test_empty_bytes_returns_empty(self):
        result = _extract_pdf_text(b"")
        assert result == ""


class TestProcessUploadedFiles:
    def test_image_file(self):
        raw = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100  # fake PNG header
        file = _make_file("photo.png", raw, "image/png")
        result = _process_uploaded_files([file])
        assert len(result) == 1
        assert result[0]["type"] == "image"
        assert result[0]["media_type"] == "image/png"
        assert result[0]["base64_data"] == base64.b64encode(raw).decode()

    def test_text_file(self):
        file = _make_file("main.py", b"print('hello')", "text/x-python")
        result = _process_uploaded_files([file])
        assert len(result) == 1
        assert result[0]["type"] == "text"
        assert result[0]["text_content"] == "print('hello')"

    def test_text_file_by_extension(self):
        """File with generic content_type but .py extension → text."""
        file = _make_file("script.py", b"x = 1", "application/octet-stream")
        result = _process_uploaded_files([file])
        assert len(result) == 1
        assert result[0]["type"] == "text"

    def test_large_text_truncated(self):
        big_content = b"x" * 200_000  # exceeds MAX_TEXT_FILE_SIZE (100KB)
        file = _make_file("big.py", big_content, "text/plain")
        result = _process_uploaded_files([file])
        assert "truncated" in result[0]["text_content"]

    def test_oversized_image_skipped(self):
        big_image = b"\x00" * (6 * 1024 * 1024)  # 6MB, exceeds 5MB limit
        file = _make_file("huge.png", big_image, "image/png")
        result = _process_uploaded_files([file])
        assert len(result) == 0  # skipped, not added

    def test_unknown_type_noted(self):
        file = _make_file("data.xlsx", b"\x00\x01", "application/vnd.ms-excel")
        result = _process_uploaded_files([file])
        assert len(result) == 1
        assert "unsupported" in result[0]["text_content"]

    def test_empty_filename_skipped(self):
        file = _make_file(None, b"data", "text/plain")
        file.filename = None
        result = _process_uploaded_files([file])
        assert len(result) == 0

    def test_jpg_with_correct_mime(self):
        """Files with image/jpeg content_type are processed correctly."""
        file = _make_file("photo.jpg", b"\xff\xd8\xff" + b"\x00" * 50, "image/jpeg")
        result = _process_uploaded_files([file])
        assert result[0]["type"] == "image"
        assert result[0]["media_type"] == "image/jpeg"

    @patch("api.chat._extract_pdf_text", return_value="Page 1 text")
    def test_pdf_file(self, mock_pdf):
        file = _make_file("doc.pdf", b"%PDF-1.4", "application/pdf")
        result = _process_uploaded_files([file])
        assert result[0]["type"] == "text"
        assert result[0]["text_content"] == "Page 1 text"

    @patch("api.chat._extract_pdf_text", return_value="")
    def test_pdf_extraction_failure(self, mock_pdf):
        file = _make_file("scan.pdf", b"%PDF-1.4", "application/pdf")
        result = _process_uploaded_files([file])
        assert "could not extract" in result[0]["text_content"]
