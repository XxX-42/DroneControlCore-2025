from fastapi import APIRouter, UploadFile, File, HTTPException
from app.infrastructure.vision.yolo_service import yolo_service

router = APIRouter()

@router.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        contents = await file.read()
        detections = await yolo_service.analyze_image(contents)
        
        return {
            "filename": file.filename,
            "detections": detections
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
