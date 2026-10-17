"""Structured session writes, with no keyword-based clinical routing."""

from google.adk.tools import ToolContext


def get_intake(tool_context: ToolContext) -> dict:
    """Read this session's recorded patient intake without accessing medical records."""
    return {"intake": dict(tool_context.state.get("intake", {}))}


def record_consent(given: bool, tool_context: ToolContext) -> dict:
    """Record explicit consent or refusal; never infer consent from an unclear answer."""
    intake = dict(tool_context.state.get("intake", {})) if given else {}
    intake["consentGiven"] = given
    tool_context.state["intake"] = intake
    return {"status": "saved", "consentGiven": given}


def record_medical_number(record: str, tool_context: ToolContext) -> dict:
    """Save a patient-provided medical number after explicit consent."""
    intake = dict(tool_context.state.get("intake", {}))
    if not intake.get("consentGiven"):
        return {"status": "error", "message": "Explicit consent is required."}
    if not record.strip():
        return {"status": "error", "message": "Medical number cannot be empty."}
    intake["recordNumber"] = record.strip()
    tool_context.state["intake"] = intake
    return {"status": "saved"}


def record_symptom(text: str, tool_context: ToolContext) -> dict:
    """Save a patient statement, preserving negation, duration and uncertainty."""
    intake = dict(tool_context.state.get("intake", {}))
    if not intake.get("consentGiven"):
        return {"status": "error", "message": "Explicit consent is required."}
    if not text.strip():
        return {"status": "error", "message": "Statement cannot be empty."}
    symptoms = list(intake.get("symptoms", []))
    if text.strip() not in symptoms:
        symptoms.append(text.strip())
    intake["symptoms"] = symptoms
    # A changed history requires a fresh routing assessment.
    intake.pop("routing", None)
    tool_context.state["intake"] = intake
    return {"status": "saved"}


def submit_routing(level: str, summary: str, reason: str, uncertainty: str,
                   tool_context: ToolContext) -> dict:
    """Save the model's proposed care route for clinician review, not a diagnosis.

    Args:
        level: emergency, telehealth, or inperson, selected from conversational context.
        summary: Factual summary of the patient's reported history.
        reason: Explanation supporting the proposed route.
        uncertainty: Missing or uncertain information; use 'none reported' if applicable.
        tool_context: ADK-provided session context.
    """
    intake = dict(tool_context.state.get("intake", {}))
    if not intake.get("consentGiven"):
        return {"status": "error", "message": "Consent required to save personal routing data."}
    if level not in {"emergency", "telehealth", "inperson"}:
        return {"status": "error", "message": "Unsupported route."}
    if not summary.strip() or not reason.strip():
        return {"status": "error", "message": "Summary and reason are required."}
    if not intake.get("symptoms"):
        return {"status": "error", "message": "Record the reported history first."}
    intake["routing"] = {
        "level": level, "summary": summary.strip(), "reason": reason.strip(),
        "uncertainty": uncertainty.strip(), "requiresClinicianReview": True,
    }
    tool_context.state["intake"] = intake
    return {"status": "saved", "routing": intake["routing"]}
