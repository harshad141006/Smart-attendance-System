import asyncio
from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient

async def seed_subjects():
    print(f"Connecting to MongoDB: {settings.mongodb_url}")
    client = AsyncIOMotorClient(settings.mongodb_url)
    db = client[settings.mongodb_db_name]
    
    # Find Saratha
    saratha = await db.users.find_one({"first_name": {"$regex": "saratha", "$options": "i"}, "role": "faculty"})
    
    saratha_id = str(saratha["_id"]) if saratha else ""
    if not saratha:
        print("Saratha not found in users collection! Creating a dummy faculty user.")
        res = await db.users.insert_one({
            "email": "saratha@example.com",
            "first_name": "Saratha",
            "last_name": "Faculty",
            "role": "faculty",
            "is_active": True
        })
        saratha_id = str(res.inserted_id)
        
    print(f"Saratha's User ID: {saratha_id}")
    
    subjects = [
        {
            "code": "DS",
            "name": "Data Structures",
            "description": "Introduction to Data Structures",
            "credits": 4,
            "department_id": "DEPT1",
            "faculty_id": saratha_id,
            "semester": 3,
            "total_sessions": 40
        },
        {
            "code": "JAVA",
            "name": "Java Programming",
            "description": "Object Oriented Programming using Java",
            "credits": 3,
            "department_id": "DEPT1",
            "faculty_id": "",
            "semester": 3,
            "total_sessions": 30
        },
        {
            "code": "AIML",
            "name": "Artificial Intelligence and Machine Learning",
            "description": "Basics of AI and ML",
            "credits": 4,
            "department_id": "DEPT1",
            "faculty_id": "",
            "semester": 5,
            "total_sessions": 45
        }
    ]
    
    for subject in subjects:
        existing = await db.subjects.find_one({"code": subject["code"]})
        if not existing:
            await db.subjects.insert_one(subject)
            print(f"Inserted subject: {subject['name']}")
        else:
            await db.subjects.update_one({"_id": existing["_id"]}, {"$set": subject})
            print(f"Updated subject: {subject['name']}")

    print("Seeding complete.")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_subjects())
