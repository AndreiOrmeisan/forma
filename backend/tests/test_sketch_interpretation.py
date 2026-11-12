from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from forma.main import create_app
from forma.shared.images import MAX_IMAGE_BYTES

ENDPOINT = "/api/v1/furniture/analyze-sketch"


def image_bytes(format: str = "PNG", color: str = "white") -> bytes:
    output = BytesIO()
    Image.new("RGB", (24, 32), color).save(output, format=format)
    return output.getvalue()


@pytest.fixture
def client():
    with TestClient(create_app()) as client:
        yield client


@pytest.mark.parametrize("format,mime", [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")])
def test_mock_interpretation(client, format, mime):
    response = client.post(ENDPOINT, files={"file": ("sketch", image_bytes(format), mime)})
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "width_mm": 800, "height_mm": 2000, "depth_mm": 600,
        "doors_count": 2, "shelves_count": 3, "furniture_type": "wardrobe",
        "is_mock": True, "requires_confirmation": True,
        "notice": "Date demonstrative, independente de conținutul fotografiei. Verifică și confirmă dimensiunile și configurația dulapului.",
    }


def test_mock_is_independent_of_image(client):
    first = client.post(ENDPOINT, files={"file": ("a.png", image_bytes(color="red"), "image/png")})
    second = client.post(ENDPOINT, files={"file": ("b.png", image_bytes(color="blue"), "image/png")})
    assert first.json() == second.json()


@pytest.mark.parametrize("content,mime,status", [
    (b"", "image/png", 422),
    (b"fake image", "image/jpeg", 422),
    (image_bytes()[:12], "image/png", 422),
    (image_bytes(), "image/jpeg", 415),
    (b"<svg/>", "image/svg+xml", 415),
    (b"heic", "image/heic", 415),
    (b"gif", "image/gif", 415),
    (b"x" * (MAX_IMAGE_BYTES + 1), "image/png", 413),
])
def test_invalid_upload(client, content, mime, status):
    response = client.post(ENDPOINT, files={"file": ("sketch.jpg", content, mime)})
    assert response.status_code == status


def test_size_boundary(client):
    content = image_bytes()
    content += b"\0" * (MAX_IMAGE_BYTES - len(content))
    response = client.post(ENDPOINT, files={"file": ("sketch.png", content, "image/png")})
    assert response.status_code == 200


def test_missing_file(client):
    assert client.post(ENDPOINT).status_code == 422


def test_post_cors(client):
    response = client.options(ENDPOINT, headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
    })
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
