import os
import uvicorn


def main() -> None:
    host = os.getenv("FORMA_HOST", "127.0.0.1")
    port = int(os.getenv("FORMA_PORT", "8000"))
    uvicorn.run("backend.app:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
