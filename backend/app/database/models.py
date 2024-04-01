from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import Integer, String, Text, Boolean, ForeignKey, DateTime, func,UniqueConstraint
from datetime import datetime

# uvicorn app.main:app --reload
# alembic revision --autogenerate -m "Description of changes"

class Base(DeclarativeBase):
    id:Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)



class Picture(Base):
    __tablename__ = 'pictures'
    file_path:Mapped[str]
    character_id:Mapped[int] = mapped_column(ForeignKey("characters.id"),nullable=True)
    character : Mapped["Character"] = relationship("Character", back_populates="pictures")



class Character(Base):
    __tablename__ = "characters"
    file_path:Mapped[str]
    name:Mapped[str]
    user_id :Mapped[int] = mapped_column(ForeignKey("users.id"))

    user: Mapped["User"] = relationship("User",back_populates="characters")
    pictures: Mapped[list[Picture]] = relationship("Picture", back_populates="character")



class User(Base):
    __tablename__ = 'users'
    name :Mapped[str] = mapped_column(String, unique=True)
    password :Mapped[str] = mapped_column(String)
    email: Mapped[str] = mapped_column(String,unique=True)

    characters: Mapped[list[Character]] = relationship("Character", back_populates="user")



# class Picture(Base):
# 	__tablename__ = "pictures"
# 	file_path:Mapped[str]
# 	#relationships
# 	user_id:Mapped[int] = mapped_column(ForeignKey("users.id"),nullable=True)
# 	user: Mapped["User"] = relationship("User", back_populates="pictures")

# 	pet_id:Mapped[int] = mapped_column(ForeignKey("pets.id"),nullable=True)
# 	pet: Mapped["Pet"] = relationship("Pet", back_populates="pictures")

# class User(Base):
# 	__tablename__ = "users"
	
# 	first_name: Mapped[str] = mapped_column(String(50))
# 	last_name: Mapped[str] = mapped_column(String(50))
# 	user_name: Mapped[str] = mapped_column(String(50),unique=True)
# 	password:Mapped[str] = mapped_column(String(1000))
# 	email: Mapped[str] = mapped_column(String(50),unique=True)

# 	member_since: Mapped[datetime] = mapped_column(DateTime, nullable=True)
# 	adress: Mapped[str] = mapped_column(String(50),nullable=True)
# 	phone_nr: Mapped[str] = mapped_column(String(20),nullable=True)
# 	active: Mapped[bool] = mapped_column(Boolean,default=True)
	
# 	#relationships
# 	pets: Mapped[list[Pet]] = relationship("Pet", back_populates="user")
# 	pictures: Mapped[list[Picture]] = relationship("Picture", back_populates="user")
# 	posts: Mapped[list[Post]] = relationship("Post", back_populates="user")
# 	favorites: Mapped[list[Favorite]] = relationship("Favorite", back_populates="user")

# 	likes_given = relationship('Like', foreign_keys='Like.liker_id', back_populates='liker')
# 	likes_received = relationship('Like', foreign_keys='Like.liked_id', back_populates='liked')
    
# 	sent_messages : Mapped[list[Message]] = relationship("Message",foreign_keys='Message.sender_id',back_populates="sender")
# 	received_messages: Mapped[list[Message]] = relationship("Message",foreign_keys='Message.receiver_id', back_populates="receiver")

# 	def __repr__(self):
# 		return f"<User ={self.first_name} {self.last_name} aka {self.user_name}>" 
	













# class Favorite(Base):
#     __tablename__ = "favorites"
#     user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
#     pet_id: Mapped[int] = mapped_column(ForeignKey("pets.id"))

#     user: Mapped["User"] = relationship(back_populates="favorites")
#     pet: Mapped["Pet"] = relationship(back_populates="favored")
    
    
#     __table_args__ = (
#         UniqueConstraint("user_id", "pet_id"),
#     )


# class Like(Base):
#     __tablename__ = 'likes'
#     __table_args__=(
# 		UniqueConstraint('liker_id','liked_id'),
# 	)
#     # Mapped[int] not needed?
#     liker_id = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
#     liked_id = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
    
#     liker = relationship('User', foreign_keys=[liker_id], back_populates='likes_given')
#     liked = relationship('User', foreign_keys=[liked_id], back_populates='likes_received')

# class Message(Base):
#     __tablename__ = 'messages'

#     sender_id = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
#     receiver_id = mapped_column(Integer, ForeignKey('users.id'), nullable=False)
#     text: Mapped[str] = mapped_column(String(200), nullable=True)
    
#     sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
#     receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")




# class Post(Base):
# 	__tablename__ = "posts"

# 	text: Mapped[str] = mapped_column(String(200), nullable=True)
# 	date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
# 	user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
	
# 	user: Mapped["User"] = relationship("User", back_populates="posts")

# 	def __repr__(self):
# 		return f"<Post = {self.text} {self.date} {self.user_id}>"

# class Pet(Base):
# 	__tablename__ = "pets"
	
# 	animal: Mapped[str] = mapped_column(String(50))
# 	race: Mapped[str] = mapped_column(String(50))
# 	age: Mapped[int] = mapped_column(Integer)
# 	name: Mapped[str] = mapped_column(String)
# 	text: Mapped[str] = mapped_column(Text)
# 	gender: Mapped[str]

# 	# new entries for listings
# 	listing_type: Mapped[str] = mapped_column(String(50), nullable=True)
# 	weight: Mapped[str] = mapped_column(String(50), nullable=True)
# 	spayed: Mapped[bool] = mapped_column(nullable=True)
# 	price: Mapped[str] = mapped_column(String(50), nullable=True)
	
# 	listing_description: Mapped[str] = mapped_column(Text, nullable=True)
# 	listing_title:Mapped[str] = mapped_column(String(50), nullable=True)

# 	#relationships
# 	user_id: Mapped[int] = mapped_column(ForeignKey("users.id"),nullable=True)
# 	user: Mapped["User"] = relationship("User", back_populates="pets")
# 	pictures: Mapped[list[Picture]] = relationship("Picture", back_populates="pet")
# 	favored: Mapped[list[Favorite]] = relationship("Favorite", back_populates="pet")
	
# 	def __repr__(self):
# 		return f"<Pet ={self.name}>"
	
