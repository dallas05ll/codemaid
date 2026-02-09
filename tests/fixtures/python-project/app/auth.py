from app.database import get_user

def authenticate(username):
    user = get_user(username)
    return user
