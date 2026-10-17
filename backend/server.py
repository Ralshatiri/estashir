"""Local application API: React -> ADK Runner -> Gemini -> session state."""

import asyncio
import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).parent / "agents" / "estashir" / ".env")

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from agents.estashir.agent import root_agent, live_agent
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig
from live_transport import live_messages
from urllib.parse import urlparse

APP_NAME = "estashir"
USER_ID = "local-demo"
sessions = InMemorySessionService()
runner = Runner(agent=root_agent, app_name=APP_NAME, session_service=sessions)
live_runner = Runner(agent=live_agent, app_name=APP_NAME, session_service=sessions)
locks: dict[str, asyncio.Lock] = {}
app = FastAPI(title="Estashir local agent API")
logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=20, max_length=128)
    message: str = Field(min_length=1, max_length=8000)


def require_key():
    key = os.getenv("GOOGLE_API_KEY", "").strip()
    if not key or key == "your-google-ai-studio-api-key":
        raise HTTPException(503, "ضع GOOGLE_API_KEY في ملف إعدادات الوكيل ثم أعد تشغيل الخادم.")


def frontend_patch(intake: dict) -> dict:
    """Translate recorded ADK state, never infer clinical routing here."""
    patch = {
        "consentGiven": intake.get("consentGiven", False),
        "recordNumber": intake.get("recordNumber", ""),
        "symptoms": intake.get("symptoms", []),
        "triage": "pending", "triageSummary": "",
        "patientStatus": "chatting", "arrivalStatus": "none",
    }
    routing = intake.get("routing")
    if routing:
        level = routing["level"]
        patch.update(
            triage=level,
            triageSummary=routing["summary"] + "\n" + routing["reason"],
            patientStatus="emergency" if level == "emergency" else "arrival",
            arrivalStatus="none" if level == "emergency" else "proposed",
        )
    return patch


@app.get("/api/health")
async def health():
    return {"status": "ok", "agent": APP_NAME, "configured": bool(os.getenv("GOOGLE_API_KEY"))}


@app.post("/api/sessions")
async def create_session():
    require_key()
    session_id = secrets.token_urlsafe(32)
    await sessions.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
    locks[session_id] = asyncio.Lock()
    return {"session_id": session_id}


@app.post("/api/chat")
async def chat(body: ChatRequest):
    require_key()
    if not body.message.strip():
        raise HTTPException(422, "الرسالة فارغة.")
    lock = locks.get(body.session_id)
    if lock is None:
        raise HTTPException(404, "انتهت الجلسة. ابدأ محادثة جديدة.")
    if lock.locked():
        raise HTTPException(409, "انتظر اكتمال الرد السابق.")
    async with lock:
        try:
            async with asyncio.timeout(90):
                replies = []
                async for event in runner.run_async(
                    user_id=USER_ID, session_id=body.session_id,
                    new_message=types.Content(role="user", parts=[types.Part(text=body.message.strip())]),
                ):
                    if event.error_code:
                        raise RuntimeError("Agent returned an error event")
                    if event.is_final_response() and event.content:
                        replies.extend(part.text for part in event.content.parts or []
                                       if part.text and not part.thought)
                if not replies:
                    raise RuntimeError("Agent returned no final text")
                session = await sessions.get_session(
                    app_name=APP_NAME, user_id=USER_ID, session_id=body.session_id,
                )
                return {"reply": "\n".join(replies),
                        "patch": frontend_patch(session.state.get("intake", {}))}
        except Exception:
            # A failed invocation can contain partial history/tools. Retire it instead
            # of silently replaying the same patient message into that history.
            locks.pop(body.session_id, None)
            await sessions.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=body.session_id)
            logger.warning("Agent invocation failed; session retired")
            raise HTTPException(502, "تعذّر الحصول على رد من الوكيل. ابدأ محادثة جديدة وحاول مجددًا.") from None


@app.websocket("/api/live")
async def live(websocket: WebSocket):
    """PCM microphone -> ADK run_live -> Gemini native PCM, plus captions/state."""
    origin = websocket.headers.get("origin")
    if origin and urlparse(origin).hostname not in {"localhost", "127.0.0.1", "::1"}:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    session_id = None
    acquired = False
    tasks = []
    queue = LiveRequestQueue()
    try:
        require_key()
        handshake = await asyncio.wait_for(websocket.receive_json(), timeout=15)
        session_id = handshake.get("session_id") if isinstance(handshake, dict) else None
        if not isinstance(session_id, str) or session_id not in locks:
            await websocket.send_json({"type": "error", "message": "انتهت الجلسة. ابدأ مكالمة جديدة."})
            return
        lock = locks[session_id]
        if lock.locked():
            await websocket.send_json({"type": "error", "message": "الجلسة مستخدمة بالفعل."})
            return
        await lock.acquire()
        acquired = True
        config = RunConfig(
            response_modalities=[types.Modality.AUDIO],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            session_resumption=types.SessionResumptionConfig(),
        )

        async def receive_audio():
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    return
                pcm = message.get("bytes")
                if pcm is None or not pcm or len(pcm) > 32000 or len(pcm) % 2:
                    await websocket.close(code=1008, reason="Expected mono PCM16 at 16000 Hz")
                    return
                queue.send_realtime(types.Blob(data=pcm, mime_type="audio/pcm;rate=16000"))

        async def send_events():
            queue.send_content(types.Content(role="user", parts=[types.Part(
                text="ابدأ المكالمة وعرّف بنفسك واطلب الموافقة قبل جمع معلومات الحالة. تحدث بالعربية باللهجة السعودية."
            )]))
            async for event in live_runner.run_live(
                user_id=USER_ID, session_id=session_id,
                live_request_queue=queue, run_config=config,
            ):
                if event.error_code:
                    raise RuntimeError("Live model error")
                for message in live_messages(event):
                    # State arrives before turn_complete so playback can finish
                    # before React navigates to an arrival/emergency screen.
                    if message["type"] == "turn_complete" and message["idle"]:
                        session = await sessions.get_session(
                            app_name=APP_NAME, user_id=USER_ID, session_id=session_id,
                        )
                        await websocket.send_json({"type": "state", "patch": frontend_patch(session.state.get("intake", {}))})
                    await websocket.send_json(message)

        await websocket.send_json({"type": "ready"})
        tasks = [asyncio.create_task(receive_audio()), asyncio.create_task(send_events())]
        done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            task.result()
    except WebSocketDisconnect:
        pass
    except Exception as error:
        logger.warning("Live connection ended: %s", type(error).__name__)
        try:
            message = error.detail if isinstance(error, HTTPException) else "تعذّر الاتصال بـ Gemini Live. تحقق من إعدادات الخلفية وأعد المحاولة."
            await websocket.send_json({"type": "error", "message": message})
        except (RuntimeError, WebSocketDisconnect):
            pass
    finally:
        queue.close()
        for task in tasks:
            task.cancel()
        if acquired:
            locks.pop(session_id, None)
            await sessions.delete_session(app_name=APP_NAME, user_id=USER_ID, session_id=session_id)
        await asyncio.gather(*tasks, return_exceptions=True)
        try:
            await websocket.close()
        except (RuntimeError, WebSocketDisconnect):
            pass
