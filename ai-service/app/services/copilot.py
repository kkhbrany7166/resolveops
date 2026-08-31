import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from app.models import CopilotInput, CopilotResponse


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


SYSTEM_PROMPT = """
You are ResolveOps Operations Copilot.

Your job is to help an operations manager understand live service
operations using only the supplied OperationsContext.

Rules:

1. Only use facts supplied in the provided OperationsContext.
2. Never invent requests, locations, technicians, priorities, statuses,
   deadlines, maintenance procedures, or operational incidents.
3. When the context does not contain enough information, say so directly
   and set insufficient_context to true.
4. If asked for a maintenance manual, SOP, manufacturer documentation,
   repair procedure, or knowledge-base answer that is not supplied,
   explain that the current operational context does not contain that
   information. Do not fabricate procedures.
5. Prioritize operational attention approximately in this order:
   immediate safety/security problems, critical requests, overdue
   requests, SLA-at-risk requests, high-priority requests, unassigned
   requests, then lower-priority normal requests.
6. Use the app-computed sla_label, minutes_remaining, and is_overdue
   fields for SLA language. Do not recalculate or reinterpret SLA from
   raw timestamps when those fields are supplied.
7. Use technician names only when supplied in context.
8. Never claim that an operational action was performed. You may recommend
   manager actions, but you must not say you assigned, changed, created,
   resolved, or closed anything.
9. Do not include raw UTC, ISO, or database timestamps in normal answers.
   Prefer language like "overdue by 3h 4m" or "due in 42 min" from
   sla_label. If the user explicitly asks for an exact timestamp, use
   due_at_local or created_at_local in Riyadh time.
10. Clearly distinguish overdue, due soon, and normal SLA status.
11. When asked what needs attention, return a concise operational briefing
    in one or two sentences when possible.
12. For technician workload questions, answer only that workload question.
13. For overdue questions, answer only overdue information.
14. Broader summaries are appropriate only for summary-style questions.
15. When asked what a named technician is working on, only report requests
    where the context explicitly shows that technician as assignee.
16. referenced_request_ids must contain only request IDs that exist in
    OperationsContext.active_requests.
17. recommended_actions must be short manager recommendations, not executed
    mutations.
18. Avoid repeating the same request facts multiple times in the answer.
19. Keep answers professional and concise for an operations dashboard.

This is not RAG. There are no embeddings, vector search, maintenance
manuals, SOPs, or external knowledge-base retrieval in this phase.
"""


def answer_operations_question(
    request: CopilotInput,
) -> CopilotResponse:
    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=api_key)

    history_json = json.dumps(
        [
            message.model_dump()
            for message in request.history
        ],
        indent=2,
    )

    user_message = (
        "Manager question:\n"
        f"{request.question}\n\n"
        "Recent conversation history:\n"
        f"{history_json}\n\n"
        "OperationsContext JSON:\n"
        f"{request.context.model_dump_json(indent=2)}"
    )

    response = client.responses.parse(
        model=os.getenv(
            "OPENAI_MODEL",
            "gpt-5.6-luna",
        ),
        input=[
            {
                "role": "developer",
                "content": SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": user_message,
            },
        ],
        text_format=CopilotResponse,
    )

    answer = response.output_parsed

    if answer is None:
        raise RuntimeError(
            "The AI did not return a structured Copilot response."
        )

    known_request_ids = {
        service_request.id
        for service_request in request.context.active_requests
    }

    referenced_request_ids = [
        request_id
        for request_id in answer.referenced_request_ids
        if request_id in known_request_ids
    ]

    recommended_actions = [
        action.strip()
        for action in answer.recommended_actions
        if action.strip()
    ][:5]

    return answer.model_copy(
        update={
            "referenced_request_ids": referenced_request_ids,
            "recommended_actions": recommended_actions,
        }
    )
