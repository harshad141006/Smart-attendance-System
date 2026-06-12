import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def print_users():
    client = AsyncIOMotorClient("mongodb://localhost:27017/")
    db = client["smart_attendance_db"]
    users = await db["users"].find().to_list(None)
    print("Found users:")
    for u in users:
        print(f"Email: {u.get('email')}, Role: {u.get('role')}, First Name: {u.get('first_name')}")

if __name__ == "__main__":
    asyncio.run(print_users())
