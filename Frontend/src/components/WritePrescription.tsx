import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { X, FileText, Plus, Trash2, CheckCircle2, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface WritePrescriptionProps {
  onClose: () => void;
}

const API = API_BASE;
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

interface MedLine {
  id:           number;
  medication:   string;
  dosage:       string;
  instructions: string;
}

export function WritePrescription({ onClose }: WritePrescriptionProps) {
  const [patients, setPatients]         = useState<any[]>([]);
  const [patientId, setPatientId]       = useState("");
  const [patientName, setPatientName]   = useState("");
  const [medications, setMedications]   = useState<MedLine[]>([
    { id: 1, medication: "", dosage: "", instructions: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [toastMsg, setToastMsg]         = useState("");

  // ── AI Assist state ────────────────────────────────────────────────────────
  const [aiOpen, setAiOpen]       = useState(false);
  const [aiText, setAiText]       = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]     = useState("");
  const [aiSuccess, setAiSuccess] = useState("");

  // Load patients who have appointments with this doctor
  useEffect(() => {
    const load = async () => {
      try {
        const res  = await fetch(`${API}/appointments`, { headers: authHeader() });
        const data = await res.json();
        if (Array.isArray(data)) {
          const seen = new Set<number>();
          const unique = data
            .filter((a: any) => {
              if (seen.has(a.patient_id)) return false;
              seen.add(a.patient_id);
              return true;
            })
            .map((a: any) => ({ id: a.patient_id, name: a.patient_name || "Unknown Patient" }));
          setPatients(unique);
        }
      } catch {}
    };
    load();
  }, []);

  // ── AI extract handler ─────────────────────────────────────────────────────
  const handleAIExtract = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiSuccess("");

    try {
      const res = await fetch(`${API}/prescriptions/extract`, {
        method:  "POST",
        headers: authHeader(),
        body:    JSON.stringify({ text: aiText.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAiError(data.error || "Extraction failed.");
        setAiLoading(false);
        return;
      }

      const medicines: any[] = data.medicines || [];
      if (medicines.length === 0 || !medicines[0].drug) {
        setAiError("No medicines detected — try rephrasing your input.");
        setAiLoading(false);
        return;
      }

      // Convert ML output into medication rows — fully editable after filling
      const filled: MedLine[] = medicines.map((m, i) => ({
        id:           Date.now() + i,
        medication:   m.drug || "",
        dosage:       [m.dose, m.frequency].filter(Boolean).join(", "),
        instructions: [m.duration, m.route].filter(Boolean).join(", "),
      }));

      setMedications(filled);
      setAiSuccess(`✅ ${filled.length} medicine(s) extracted — review and edit below.`);
      setAiText("");
    } catch {
      setAiError("Could not reach the ML service. Make sure ML_API_URL is set.");
    }

    setAiLoading(false);
  };

  // ── Medication helpers ─────────────────────────────────────────────────────
  const addMedication = () => {
    setMedications([...medications, { id: Date.now(), medication: "", dosage: "", instructions: "" }]);
  };

  const removeMedication = (id: number) => {
    if (medications.length === 1) return;
    setMedications(medications.filter((m) => m.id !== id));
  };

  const updateMed = (id: number, field: keyof MedLine, value: string) => {
    setMedications(medications.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!patientId) {
      setToastMsg("❌ Please select a patient");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }
    if (!medications[0].medication) {
      setToastMsg("❌ Please add at least one medication");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    setIsSubmitting(true);
    try {
      const results = await Promise.all(
        medications
          .filter((m) => m.medication.trim())
          .map((m) =>
            fetch(`${API}/prescriptions`, {
              method:  "POST",
              headers: authHeader(),
              body:    JSON.stringify({
                patient_id:   parseInt(patientId),
                medication:   m.medication,
                dosage:       m.dosage,
                instructions: m.instructions,
              }),
            }).then((r) => r.json())
          )
      );
      if (results.every((r) => r.id)) {
        setSubmitted(true);
        setTimeout(onClose, 2500);
      } else {
        setToastMsg("❌ Some prescriptions failed to save");
        setTimeout(() => setToastMsg(""), 3000);
      }
    } catch {
      setToastMsg("❌ Could not connect to server");
      setTimeout(() => setToastMsg(""), 3000);
    }
    setIsSubmitting(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.25 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-[#008080] rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Write Prescription</p>
              <p className="text-xs text-gray-500">Issue medication to your patient</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full p-1.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">

          {/* Toast */}
          {toastMsg && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
              {toastMsg}
            </div>
          )}

          {/* Success state */}
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-8 space-y-4"
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Prescription Sent!</h3>
              <p className="text-gray-500 text-sm">
                {medications.filter((m) => m.medication).length} medication(s) prescribed to{" "}
                {patientName || "patient"}
              </p>
            </motion.div>
          ) : (
            <>
              {/* ── AI Assist panel ────────────────────────────────────────── */}
              <div className="border border-teal-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setAiOpen(!aiOpen); setAiError(""); setAiSuccess(""); }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-teal-50 hover:bg-teal-100 transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-teal-700">
                    <Sparkles className="w-4 h-4" />
                    AI Auto-Fill
                    <span className="text-xs font-normal text-teal-500">
                      (English &amp; Hindi)
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-teal-600 transition-transform duration-200 ${
                      aiOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {aiOpen && (
                    <motion.div
                      key="ai-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-3 bg-white border-t border-teal-100">
                        <p className="text-xs text-gray-500">
                          Type a prescription sentence in English or Hindi. Multiple medicines
                          separated by <em>"and"</em> are all detected and filled automatically.
                        </p>

                        <textarea
                          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none
                                     focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder-gray-300"
                          rows={3}
                          placeholder={
                            "e.g. Paracetamol 650 mg twice daily for 5 days after food " +
                            "and Azithromycin 500 mg OD for 3 days\n" +
                            "or: Ramipril 5 mg subah ko 1 mahine paani ke saath"
                          }
                          value={aiText}
                          onChange={(e) => setAiText(e.target.value)}
                        />

                        {aiError   && <p className="text-red-500 text-xs">{aiError}</p>}
                        {aiSuccess && <p className="text-teal-600 text-xs font-medium">{aiSuccess}</p>}

                        <Button
                          type="button"
                          onClick={handleAIExtract}
                          disabled={aiLoading || !aiText.trim()}
                          className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm"
                        >
                          {aiLoading ? "Extracting…" : "✨ Extract & Fill Form"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Patient Selection ─────────────────────────────────────── */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Patient *
                </Label>
                {patients.length === 0 ? (
                  <div className="border rounded-xl p-4 bg-gray-50 text-center">
                    <p className="text-sm text-gray-400">
                      No patients found. Patients who book appointments will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto border rounded-xl p-2 bg-gray-50">
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setPatientId(String(p.id)); setPatientName(p.name); }}
                        className={`flex items-center space-x-3 p-3 rounded-lg text-left transition-all ${
                          patientId === String(p.id)
                            ? "bg-[#008080] text-white"
                            : "bg-white hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name}`}
                          />
                          <AvatarFallback className="text-xs">PT</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{p.name}</span>
                        {patientId === String(p.id) && (
                          <CheckCircle2 className="w-4 h-4 ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Medications ───────────────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Medications *
                    {aiSuccess && (
                      <span className="ml-2 text-xs font-normal text-teal-600">
                        (AI-filled — edit as needed)
                      </span>
                    )}
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMedication}
                    className="text-[#008080] border-[#008080] hover:bg-[#008080] hover:text-white"
                  >
                    <Plus className="w-4 h-4 mr-1" />Add More
                  </Button>
                </div>

                <div className="space-y-3">
                  {medications.map((med, index) => (
                    <div key={med.id} className="border rounded-xl p-4 bg-gray-50 space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          Medicine {index + 1}
                        </Badge>
                        {medications.length > 1 && (
                          <button
                            onClick={() => removeMedication(med.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">
                            Medicine Name *
                          </Label>
                          <Input
                            placeholder="e.g. Paracetamol"
                            value={med.medication}
                            onChange={(e) => updateMed(med.id, "medication", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 block">
                            Dosage &amp; Frequency
                          </Label>
                          <Input
                            placeholder="e.g. 650 mg, twice daily"
                            value={med.dosage}
                            onChange={(e) => updateMed(med.id, "dosage", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-gray-500 mb-1 block">
                          Instructions
                        </Label>
                        <Input
                          placeholder="e.g. for 5 days, after food"
                          value={med.instructions}
                          onChange={(e) => updateMed(med.id, "instructions", e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!submitted && (
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <Button variant="ghost" className="text-gray-500" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-[#008080] hover:bg-[#008080]/90 px-6"
              onClick={handleSubmit}
              disabled={isSubmitting || !patientId}
            >
              {isSubmitting ? "Sending..." : "✅ Send Prescription"}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
