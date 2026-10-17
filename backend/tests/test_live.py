import base64
import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from google.adk.events import Event
from google.genai import types
from starlette.websockets import WebSocketDisconnect

import server
from live_transport import live_messages


class FakeLiveRunner:
    def __init__(self):
        self.audio = None
        self.config = None

    async def run_live(self, *, user_id, session_id, live_request_queue, run_config):
        self.config = run_config
        greeting = await live_request_queue.get()
        assert greeting.content.parts[0].text
        audio = await live_request_queue.get()
        self.audio = audio.blob
        yield Event(
            invocation_id="test-live", author="estashir", turn_complete=True,
            input_transcription=types.Transcription(text="مرحبا"),
            output_transcription=types.Transcription(text="أهلا بك"),
            content=types.Content(role="model", parts=[types.Part(
                inline_data=types.Blob(data=b"\x00\x00\x01\x00", mime_type="audio/pcm;rate=24000")
            )]),
        )
        await live_request_queue.get()


class LiveTests(unittest.TestCase):
    def test_audio_and_captions_round_trip_through_websocket(self):
        fake = FakeLiveRunner()
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(server, "live_runner", fake):
            with TestClient(server.app) as client:
                session_id = client.post("/api/sessions").json()["session_id"]
                with client.websocket_connect("/api/live", headers={"origin": "http://localhost:5173"}) as socket:
                    socket.send_json({"session_id": session_id})
                    self.assertEqual(socket.receive_json()["type"], "ready")
                    socket.send_bytes(b"\x01\x00" * 640)
                    messages = [socket.receive_json() for _ in range(5)]
                    self.assertEqual([m["type"] for m in messages], [
                        "input_transcript", "output_transcript", "audio", "state", "turn_complete",
                    ])
                    self.assertEqual(base64.b64decode(messages[2]["data"]), b"\x00\x00\x01\x00")
                    self.assertTrue(messages[-1]["idle"])
                self.assertEqual(fake.audio.data, b"\x01\x00" * 640)
                self.assertEqual(fake.audio.mime_type, "audio/pcm;rate=16000")
                self.assertEqual(fake.config.response_modalities, [types.Modality.AUDIO])
            self.assertNotIn(session_id, server.locks)

    def test_untrusted_browser_origin_is_rejected(self):
        with TestClient(server.app) as client:
            with self.assertRaises(WebSocketDisconnect) as error:
                with client.websocket_connect("/api/live", headers={"origin": "https://example.com"}):
                    pass
            self.assertEqual(error.exception.code, 1008)

    def test_interruption_is_forwarded(self):
        event = Event(invocation_id="test", author="estashir", interrupted=True)
        self.assertEqual(live_messages(event), [{"type": "interrupted"}])

    def test_intermediate_turn_does_not_finish_interaction(self):
        event = Event(invocation_id="test", author="estashir", turn_complete=True,
                      interaction_status=types.InteractionStatus.IN_PROGRESS)
        self.assertEqual(live_messages(event), [{"type": "turn_complete", "idle": False}])
