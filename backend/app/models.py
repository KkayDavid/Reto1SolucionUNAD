from sqlalchemy import Column, Integer, String, Text
from app.database import Base

class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String, index=True)
    subject = Column(String, index=True)
    body = Column(Text)
    radicado = Column(String, index=True)
