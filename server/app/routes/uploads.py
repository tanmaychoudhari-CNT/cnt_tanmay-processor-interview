from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import StandardResponse, UploadResult
from app.services import parse_upload
from app.services.file_parser import SUPPORTED_EXTENSIONS, UnsupportedFileError

from ._deps import current_user


router = APIRouter(prefix="/uploads", tags=["uploads"])


MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


@router.post("", response_model=StandardResponse[UploadResult])
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    filename = (file.filename or "").lower()
    if not any(filename.endswith(ext) for ext in SUPPORTED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"unsupported file extension; allowed: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="file exceeds 25 MB limit")

    try:
        result = parse_upload(
            db,
            file.filename or "upload",
            content,
            user_id=user.id,
        )
    except UnsupportedFileError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except ValueError as err:
        raise HTTPException(status_code=400, detail=f"failed to parse file: {err}")

    return StandardResponse(data=UploadResult(**result))
