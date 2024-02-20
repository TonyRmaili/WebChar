from db import Base,engine
import asyncio

async def create_db():
    async with engine.begin() as con:
        from models import Note

        await con.run_sync(Base.metadata.drop_all)
        await con.run_sync(Base.metadata.create_all)
    
    await engine.dispose()

asyncio.run(create_db())