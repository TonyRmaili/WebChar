from models import Base,User,Comment
from connect import engine


print("creating tables")
Base.metadata.create_all(bind=engine)

