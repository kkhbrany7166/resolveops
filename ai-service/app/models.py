from typing import Literal

from pydantic import BaseModel, Field, field_validator


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


class CopilotMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)


class CopilotRequestContext(BaseModel):
    id: str
    title: str
    description: str
    category: str
    priority: Literal["low", "medium", "high", "critical"]
    status: Literal[
        "new",
        "assigned",
        "in_progress",
        "on_hold",
        "resolved",
        "closed",
    ]
    location: str
    assignee_name: str | None
    due_at: str | None
    due_at_local: str | None
    sla_label: str
    minutes_remaining: int | None
    is_overdue: bool


class CopilotActivityContext(BaseModel):
    request_id: str
    action: str
    detail: str
    created_at: str
    created_at_local: str | None


class CopilotMetrics(BaseModel):
    active_requests: int
    due_today: int
    sla_at_risk: int
    resolved_this_month: int
    unassigned_requests: int
    overdue_requests: int


class OperationsContext(BaseModel):
    generated_at: str
    timezone: str
    metrics: CopilotMetrics
    active_requests: list[CopilotRequestContext]
    recent_activity: list[CopilotActivityContext]


class CopilotInput(BaseModel):
    question: str = Field(min_length=2, max_length=1500)
    context: OperationsContext
    history: list[CopilotMessage] = Field(default_factory=list)

    @field_validator("history")
    @classmethod
    def limit_history(
        cls,
        value: list[CopilotMessage],
    ) -> list[CopilotMessage]:
        return value[-8:]


class CopilotResponse(BaseModel):
    answer: str = Field(min_length=1, max_length=1600)
    attention_level: Literal["normal", "watch", "urgent"]
    referenced_request_ids: list[str] = Field(max_length=8)
    recommended_actions: list[str] = Field(max_length=5)
    insufficient_context: bool
