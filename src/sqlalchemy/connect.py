from sqlalchemy import create_engine

engine = create_engine("postgresql+psycopg2://postgres:Primallord@localhost:5432/DBAlchemy",echo=True)


# from sqlalchemy import create_engine,text

# with engine.connect() as con:
#     result = con.execute(text("select 'Hello'"))
#     print(result.all())




# from sqlalchemy import create_engine,ForeignKey,Column,String,Integer,CHAR
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker


# Base = declarative_base()


# class Person(Base):
#     __tablename__ = "people3"
 
#     ssn = Column("ssn",Integer,primary_key=True)
#     firstname = Column("firstname",String)
#     lastname = Column("lastname",String)

#     def __init__(self,id,first,last):
#         self.ssn = id
#         self.firstname= first
#         self.lastname =last

# engine = create_engine("postgresql+psycopg2://postgres:Primallord@localhost:5432/DBAlchemy")
# Base.metadata.create_all(bind=engine)

# Session = sessionmaker(bind=engine)
# session = Session()

# p1 = Person(1,'to','rm')

# session.add(p1)
# session.commit()

   


# from sqlalchemy import text
# with engine.connect() as conn:
#     conn.execute(text("CREATE TABLE some_table (x int, y int)"))
#     conn.execute(
#         text("INSERT INTO some_table (x, y) VALUES (:x, :y)"),
#         [{"x": 1, "y": 1}, {"x": 2, "y": 4}],
#     )
#     conn.commit()