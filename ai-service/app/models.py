from typing import Literal

from pydantic import BaseModel, Field


class AnalyzeRequestInput(BaseModel):
    description: str = Field(min_length=5, max_length=2000)
    location: str | None = None


class ServiceRequestAnalysis(BaseModel):
    title: str = Field(min_length=3, max_length=100)

    category: Literal[
        "hvac",
        "electrical",
        "plumbing",
        "security",
        "other",
    ]

    priority: Literal[
        "low",
        "medium",
        "high",
        "critical",
    ]

    department: Literal[
        "Engineering",
        "Security",
        "Operations",
    ]

    summary: str

    location: str | None

    sentiment: Literal[
        "calm",
        "neutral",
        "frustrated",
        "angry",
        "urgent",
    ]

    requires_human_escalation: bool

    suggested_response: str