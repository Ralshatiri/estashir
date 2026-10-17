"""Deterministic tool checks; these do not evaluate the model's clinical judgment."""

import unittest
from types import SimpleNamespace

from agents.estashir.tools import (
    get_intake, record_consent, record_medical_number, record_symptom, submit_routing,
)


class IntakeToolsTests(unittest.TestCase):
    def setUp(self):
        self.context = SimpleNamespace(state={})

    def test_writes_require_consent(self):
        self.assertEqual(record_medical_number("123", self.context)["status"], "error")
        self.assertEqual(record_symptom("headache", self.context)["status"], "error")
        self.assertEqual(submit_routing("emergency", "history", "reason", "", self.context)["status"], "error")
        self.assertEqual(self.context.state, {})

    def test_negation_is_preserved(self):
        record_consent(True, self.context)
        record_symptom("لا يوجد ألم في الصدر", self.context)
        self.assertEqual(get_intake(self.context)["intake"]["symptoms"], ["لا يوجد ألم في الصدر"])
        self.assertNotIn("routing", self.context.state["intake"])

    def test_withdrawal_clears_current_intake(self):
        record_consent(True, self.context)
        record_medical_number("123", self.context)
        record_symptom("headache", self.context)
        record_consent(False, self.context)
        self.assertEqual(get_intake(self.context)["intake"], {"consentGiven": False})

    def test_new_history_invalidates_previous_route(self):
        record_consent(True, self.context)
        record_symptom("headache", self.context)
        result = submit_routing("telehealth", "headache", "reported mild symptoms", "duration unknown", self.context)
        self.assertEqual(result["status"], "saved")
        record_symptom("new information", self.context)
        self.assertNotIn("routing", get_intake(self.context)["intake"])

    def test_sessions_do_not_share_intake(self):
        other = SimpleNamespace(state={})
        record_consent(True, self.context)
        record_symptom("headache", self.context)
        self.assertEqual(get_intake(other)["intake"], {})

    def test_invalid_route_is_rejected(self):
        record_consent(True, self.context)
        record_symptom("headache", self.context)
        result = submit_routing("unknown", "summary", "reason", "", self.context)
        self.assertEqual(result["status"], "error")
        self.assertNotIn("routing", get_intake(self.context)["intake"])


if __name__ == "__main__":
    unittest.main()
