from models import User,Comment
from main import session

user1 = User(
    username ="jona",
    email_address = "jona@whatever.isis",
    comments =[
        Comment(text="Hello zardi"),
        Comment(text="garfunks says ")
    ]
)

paul = User(
    username ="paul",
    email_address = "paul@whatever.isis",
    comments =[
        Comment(text="yoyoyoyo p here"),
        Comment(text="subs says ")
    ]
)

cathy = User(
    username ="cathy",
    email_address = "cathy@whatever.isis"
)

session.add_all([user1,paul,cathy])
session.commit()