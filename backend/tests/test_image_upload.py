import io
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.routers import api


class ImageUploadTests(unittest.IsolatedAsyncioTestCase):
    async def test_image_is_saved_as_static_file(self):
        with tempfile.TemporaryDirectory() as upload_dir, patch.object(api, "UPLOADED_IMAGES_DIR", upload_dir):
            upload = UploadFile(
                filename="surface.jpg",
                file=io.BytesIO(b"test-image-content"),
                headers=Headers({"content-type": "image/jpeg"}),
            )

            result = await api.upload_image(upload)

            self.assertTrue(result["url"].startswith("/uploaded-images/"))
            stored_name = result["url"].removeprefix("/uploaded-images/")
            with open(os.path.join(upload_dir, stored_name), "rb") as stored_file:
                self.assertEqual(stored_file.read(), b"test-image-content")

    async def test_non_image_upload_is_rejected(self):
        upload = UploadFile(
            filename="notes.txt",
            file=io.BytesIO(b"not-an-image"),
            headers=Headers({"content-type": "text/plain"}),
        )

        with self.assertRaises(HTTPException) as raised:
            await api.upload_image(upload)

        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
