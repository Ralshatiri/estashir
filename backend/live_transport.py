"""Translate ADK Live events without adding speech recognition or synthesis."""

import base64


def live_messages(event) -> list[dict]:
    messages = []
    if event.interrupted:
        messages.append({"type": "interrupted"})
    for kind, transcription in (("input_transcript", event.input_transcription),
                                ("output_transcript", event.output_transcription)):
        if transcription and transcription.text:
            messages.append({"type": kind, "text": transcription.text})
    if event.content and event.author != "user":
        for part in event.content.parts or []:
            blob = part.inline_data
            if blob and blob.data and (blob.mime_type or "").startswith("audio/pcm"):
                messages.append({"type": "audio", "data": base64.b64encode(blob.data).decode("ascii"),
                                 "mime_type": blob.mime_type})
    if event.turn_complete:
        status = getattr(event.interaction_status, "value", event.interaction_status)
        messages.append({"type": "turn_complete", "idle": status != "IN_PROGRESS"})
    return messages
