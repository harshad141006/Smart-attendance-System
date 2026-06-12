# App Module
import motor.motor_asyncio

# Alias motor classes for compatibility across codebase imports
motor.motor_asyncio.AsyncClient = motor.motor_asyncio.AsyncIOMotorClient
motor.motor_asyncio.AsyncDatabase = motor.motor_asyncio.AsyncIOMotorDatabase
