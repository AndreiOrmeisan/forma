"""Bounded upload validation for supported raster images."""

from io import BytesIO
import warnings

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024
IMAGE_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def validate_uploaded_image(file: UploadFile) -> None:
    if file.content_type not in IMAGE_TYPES:
        raise HTTPException(415, "Alege o imagine JPEG, PNG sau WebP.")

    content = file.file.read(MAX_IMAGE_BYTES + 1)
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Imaginea depășește limita de 10 MB.")
    if not content:
        raise HTTPException(422, "Fișierul este gol.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                if image.format != IMAGE_TYPES[file.content_type]:
                    raise HTTPException(415, "Conținutul imaginii nu corespunde tipului declarat.")
                image.verify()
            with Image.open(BytesIO(content)) as image:
                image.load()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
        EOFError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise HTTPException(422, "Imaginea este deteriorată sau nu poate fi citită.") from None
