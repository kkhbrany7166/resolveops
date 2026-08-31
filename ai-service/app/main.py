from fastapi import FastAPI, HTTPException

from app.models import (
    AnalyzeRequestInput,
    CopilotInput,
    CopilotResponse,
    ServiceRequestAnalysis,
)
from app.services.copilot import answer_operations_question
from app.services.classifier import analyze_service_request


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


@app.post(
    "/analyze-request",
    response_model=ServiceRequestAnalysis,
)
def analyze_request(
    request: AnalyzeRequestInput,
):
    try:
        return analyze_service_request(
            description=request.description,
            location=request.location,
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    except Exception as error:
        print(
            f"ResolveOps AI analysis failed: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to analyze service request.",
        ) from error


@app.post(
    "/copilot",
    response_model=CopilotResponse,
)
def copilot(
    request: CopilotInput,
):
    try:
        return answer_operations_question(
            request=request,
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=503,
            detail=str(error),
        ) from error

    except Exception as error:
        print(
            f"ResolveOps Copilot failed: {error}"
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to answer operations question.",
        ) from error
