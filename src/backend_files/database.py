from sqlalchemy import Column,ForeignKey
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base


engine = create_async_engine(
    url= os.getenv("DATABASE_URL"),
    echo = True
)

class Base(DeclarativeBase):
    pass

