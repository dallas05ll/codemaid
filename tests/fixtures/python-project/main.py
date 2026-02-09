from app.auth import authenticate
from app.database import connect

def main():
    db = connect()
    user = authenticate("admin")
    print(f"Hello {user}")

if __name__ == "__main__":
    main()
