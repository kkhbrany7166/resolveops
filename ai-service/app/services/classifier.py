import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from app.models import ServiceRequestAnalysis


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")


SYSTEM_PROMPT = """
You are the request intelligence engine for ResolveOps,
a service operations platform.

Analyze incoming facility and hospitality service requests.

Your responsibilities are to:

1. Create a short operational title.
2. Classify the request into one of the allowed categories.
3. Determine its operational priority.
4. Route it to the appropriate department.
5. Produce a concise operational summary.
6. Extract the location when it is explicitly available.
7. Identify the user's sentiment.
8. Decide whether human escalation is required.
9. Draft a short professional response.

Category rules:

- hvac: air conditioning, heating, ventilation, temperature issues
- electrical: power, lighting, outlets, wiring, electrical hazards
- plumbing: leaks, pipes, drains, toilets, water systems
- security: access control, suspicious activity, safety/security incidents
- other: anything that does not fit the categories above

Department rules:

- HVAC, electrical, and plumbing -> Engineering
- Security -> Security
- Other -> Operations

Priority rules:

- critical: immediate safety risk, major operational failure,
  severe flooding, electrical danger, security threat, or another
  situation requiring immediate intervention

- high: significant guest or operational impact requiring quick action

- medium: normal service request requiring staff action

- low: minor or non-urgent request

Never invent a room number, location, incident, or factual detail
that was not provided.
"""


def analyze_service_request(
    description: str,
    location: str | None = None,
) -> ServiceRequestAnalysis:

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured.")

    client = OpenAI(api_key=api_key)

    user_message = f"Request description: {description}"

    if location:
        user_message += f"\nProvided location: {location}"

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
        text_format=ServiceRequestAnalysis,
    )

    analysis = response.output_parsed

    if analysis is None:
        raise RuntimeError(
            "The AI did not return a structured analysis."
        )

    return analysis