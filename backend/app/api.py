from fastapi import APIRouter
from .routes.emails import router as emails_router

router = APIRouter()

# Registrar rutas
router.include_router(emails_router, prefix="/emails", tags=["Emails"])
