from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import User
from app.schemas import StandardResponse, UploadResult
from app.services import parse_upload
from app.services.file_parser import SUPPORTED_EXTENSIONS, UnsupportedFileError

from ._deps import current_user, limiter


router = APIRouter(prefix="/uploads", tags=["uploads"])


# Magic-byte sniffers for each supported format. A filename-extension check
# is trivial to bypass (rename malicious.exe → data.csv), so we also peek
# at the file contents before handing them to the parser.
#
# Heuristics kept loose: CSV is plain text (no magic), JSON starts with
# `{` or `[` after whitespace, XML starts with `<`. If the content looks
# wildly wrong we reject early.
def _looks_like(ext: str, head: bytes) -> bool:
    try:
        text = head.lstrip().decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return False
    if not text:
        return False
    if ext == ".json":
        return text[0] in "[{"
    if ext == ".xml":
        return text.startswith("<")
    if ext == ".csv":
        # CSV is just text — we reject binary-looking content but accept
        # anything decodable to utf-8 plus a printable first char.
        return text[0].isprintable()
    return True


@router.post("", response_model=StandardResponse[UploadResult])
# Per-user IP throttle: 20 uploads / hour is plenty for a real operator,
# and not enough to sustain any realistic abuse.
@limiter.limit("20/hour")
async def upload(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    filename = (file.filename or "").lower()
    matched_ext = next(
        (ext for ext in SUPPORTED_EXTENSIONS if filename.endswith(ext)), None
    )
    if matched_ext is None:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported file extension; allowed: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    # Stream with a byte counter so a multi-GB upload can't wedge us in
    # memory. We read in chunks and bail the moment we exceed the cap.
    chunks: list[bytes] = []
    total = 0
    max_bytes = settings.max_upload_bytes
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"file exceeds {max_bytes // 1_000_000} MB limit",
            )
        chunks.append(chunk)
    content = b"".join(chunks)

    # Content sniffing — extension lied, reject.
    if not _looks_like(matched_ext, content[:64]):
        raise HTTPException(
            status_code=400,
            detail=f"file contents do not match the declared {matched_ext} format",
        )

    try:
        result = parse_upload(
            db,
            file.filename or "upload",
            content,
            user_id=user.id,
            max_rows=settings.max_upload_rows,
        )
    except UnsupportedFileError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=f"failed to parse file: {err}")

    return StandardResponse(data=UploadResult(**result))
