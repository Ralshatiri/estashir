import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient
from google.adk.events import Event, EventActions
from google.genai import types

import server


class FakeRunner:
    """Stand in for the paid model, exercising real ADK session state and HTTP."""
    def __init__(self):
        self.calls = []

    async def run_async(self, *, user_id, session_id, new_message):
        self.calls.append(new_message.parts[0].text)
        session = await server.sessions.get_session(
            app_name=server.APP_NAME, user_id=user_id, session_id=session_id,
        )
        intake = {"consentGiven": True, "symptoms": ["لا يوجد ألم في الصدر"],
                  "routing": {"level": "telehealth", "summary": "ملخص", "reason": "سبب"}}
        event = Event(invocation_id="test", author="estashir",
                      content=types.Content(role="model", parts=[types.Part(text="رد من الوكيل")]),
                      actions=EventActions(state_delta={"intake": intake}))
        await server.sessions.append_event(session=session, event=event)
        yield event


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test")
        self.key = patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"})
        self.key.start()
        self.fake = FakeRunner()
        self.runner = patch.object(server, "runner", self.fake)
        self.runner.start()

    async def asyncTearDown(self):
        await self.client.aclose()
        self.runner.stop()
        self.key.stop()
        server.locks.clear()

    async def test_chat_returns_model_text_and_adk_state(self):
        session_id = (await self.client.post("/api/sessions")).json()["session_id"]
        response = await self.client.post("/api/chat", json={"session_id": session_id, "message": "أوافق"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["reply"], "رد من الوكيل")
        self.assertEqual(response.json()["patch"]["triage"], "telehealth")
        self.assertEqual(response.json()["patch"]["symptoms"], ["لا يوجد ألم في الصدر"])
        self.assertEqual(self.fake.calls, ["أوافق"])

    async def test_missing_session_is_not_silently_recreated(self):
        response = await self.client.post("/api/chat", json={"session_id": "x" * 32, "message": "hello"})
        self.assertEqual(response.status_code, 404)

    async def test_unconfigured_key_has_clear_error(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": ""}):
            self.assertEqual((await self.client.post("/api/sessions")).status_code, 503)

    async def test_provider_failure_retires_partial_session(self):
        class BrokenRunner:
            async def run_async(self, **kwargs):
                raise RuntimeError("private provider detail")
                yield  # async generator protocol
        session_id = (await self.client.post("/api/sessions")).json()["session_id"]
        with patch.object(server, "runner", BrokenRunner()):
            response = await self.client.post("/api/chat", json={"session_id": session_id, "message": "hello"})
        self.assertEqual(response.status_code, 502)
        self.assertNotIn("private provider detail", response.text)
        self.assertNotIn(session_id, server.locks)

    async def test_blank_message_does_not_reach_model(self):
        session_id = (await self.client.post("/api/sessions")).json()["session_id"]
        response = await self.client.post("/api/chat", json={"session_id": session_id, "message": "   "})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.fake.calls, [])
