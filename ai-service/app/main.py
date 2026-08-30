from fastapi import FastAPI


app = FastAPI(
    title="ResolveOps AI",
    description="AI intelligence service for ResolveOps service operations.",
    version="0.1.0",
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "resolveops-ai",
    }