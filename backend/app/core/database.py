from motor.motor_asyncio import AsyncIOMotorClient as AsyncClient, AsyncIOMotorDatabase as AsyncDatabase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

mongodb_client: AsyncClient = None
mongodb_db: AsyncDatabase = None


async def connect_to_mongo():
    """Connect to MongoDB"""
    global mongodb_client, mongodb_db
    try:
        mongodb_client = AsyncClient(settings.mongodb_url)
        mongodb_db = mongodb_client[settings.mongodb_db_name]
        
        # Verify connection
        await mongodb_db.command("ping")
        logger.info("Connected to MongoDB")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


async def close_mongo_connection():
    """Close MongoDB connection"""
    global mongodb_client
    if mongodb_client:
        mongodb_client.close()
        logger.info("Disconnected from MongoDB")


def get_database() -> AsyncDatabase:
    """Get MongoDB database instance"""
    return mongodb_db
