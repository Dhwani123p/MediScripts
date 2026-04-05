import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { X, FileText, Plus, Trash2, CheckCircle2, Sparkles, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

/** Small inline badge showing AI confidence for a filled field. */
function ConfBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  if (score >= 0.85)
    return <span className="ml-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded px-1 py-0.5">HIGH {pct}%</span>;
  if (score >= 0.65)
    return <span className="ml-1 text-[10px] font-semibold text-amber-500 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">MED {pct}%</span>;
  return <span className="ml-1 text-[10px] font-semibold text-red-500 bg-red-50 border border-red-200 rounded px-1 py-0.5">LOW {pct}% ⚠</span>;
}

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
  const [aiOpen, setAiOpen]           = useState(false);
  const [aiText, setAiText]           = useState("");
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState("");
  const [aiSuccess, setAiSuccess]     = useState("");
  const [aiCountry, setAiCountry]     = useState("");   // patient's country for name mapping
  // medId → per-field confidence from ML (cleared when user edits the field)
  const [aiConfidence, setAiConfidence] = useState<Record<number, any>>({});
  // Drug-drug interactions returned by the ML API after extraction
  const [aiInteractions, setAiInteractions] = useState<any[] | null>(null);
  // Dose-range warnings (WHO limits) from ML API
  const [aiDoseWarnings, setAiDoseWarnings] = useState<any[]>([]);
  // Drug name mappings (INN → local name) for patient's country
  const [aiDrugMappings, setAiDrugMappings] = useState<any[]>([]);

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
              if (!a.patient_id || seen.has(a.patient_id)) return false;
              seen.add(a.patient_id);
              return true;
            })
            .map((a: any) => ({ id: a.patient_id, name: a.patient_name || "Unknown Patient" }));
          setPatients(unique);
          // Auto-select if only one patient
          if (unique.length === 1) {
            setPatientId(String(unique[0].id));
            setPatientName(unique[0].name);
          }
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
        body:    JSON.stringify({ text: aiText.trim(), ...(aiCountry ? { country: aiCountry } : {}) }),
      });
      const data = await res.json();

      if (!res.ok) {
        const isUnreachable = res.status === 503 || res.status === 502;
        setAiError(
          isUnreachable
            ? "⚠️ ML model is offline. Set ML_API_URL on the server, or fill the prescription manually."
            : `⚠️ ${data.error || "Extraction failed."}`
        );
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

      // Store per-field confidence so UI can show colored badges
      const newConf: Record<number, any> = {};
      filled.forEach((med, i) => {
        if (medicines[i]?.confidence) newConf[med.id] = medicines[i].confidence;
      });

      setMedications(filled);
      setAiConfidence(newConf);
      setAiInteractions(data.interactions || []);
      setAiDoseWarnings(data.dose_warnings || []);
      setAiDrugMappings(data.drug_mappings || []);
      setAiSuccess(`✅ ${filled.length} medicine(s) extracted — review and edit below.`);
      setAiText("");
    } catch {
      setAiError("⚠️ Could not reach the server. Check your connection and try again.");
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

  // Map UI field → which ML confidence keys to clear when user edits
  const CONF_KEYS: Partial<Record<keyof MedLine, string[]>> = {
    medication:   ["drug"],
    dosage:       ["dose", "frequency"],
    instructions: ["duration", "route"],
  };

  const updateMed = (id: number, field: keyof MedLine, value: string) => {
    setMedications(medications.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
    // Clear the relevant ML confidence keys so the badge disappears
    const keys = CONF_KEYS[field];
    if (keys && aiConfidence[id]) {
      setAiConfidence((prev) => {
        const updated = { ...prev[id] };
        keys.forEach((k) => delete updated[k]);
        return { ...prev, [id]: updated };
      });
    }
  };

  // Returns the display confidence (0–1) for a given UI field of a medication row.
  const getFieldConf = (medId: number, field: "medication" | "dosage" | "instructions"): number | null => {
    const c = aiConfidence[medId];
    if (!c) return null;
    if (field === "medication") return c.drug ?? null;
    if (field === "dosage") {
      const vals = [c.dose, c.frequency].filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    if (field === "instructions") {
      const vals = [c.duration, c.route].filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    }
    return null;
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
      const valid = medications.filter((m) => m.medication.trim());

      // When AI was used (interactions present or multiple meds), save as one
      // bundled record so interactions stay associated with the whole prescription.
      if (aiInteractions !== null) {
        const medicationsJson = JSON.stringify(
          valid.map((m) => ({ name: m.medication, dosage: m.dosage, instructions: m.instructions }))
        );
        const res = await fetch(`${API}/prescriptions`, {
          method:  "POST",
          headers: authHeader(),
          body:    JSON.stringify({
            patient_id:      parseInt(patientId),
            medication:      valid[0].medication,
            dosage:          valid.map((m) => m.dosage).filter(Boolean).join("; "),
            instructions:    valid.map((m) => m.instructions).filter(Boolean).join("; "),
            medications_json: medicationsJson,
            interactions:    aiInteractions,
          }),
        });
        const data = await res.json();
        if (data.id) {
          setSubmitted(true);
          setTimeout(onClose, 2500);
        } else {
          setToastMsg("❌ Failed to save prescription — " + (data.error || "please try again"));
          setTimeout(() => setToastMsg(""), 3000);
        }
      } else {
        // Manual entry — save one record per medication (legacy path)
        const results = await Promise.all(
          valid.map((m) =>
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

                        {/* Patient's country — enables local drug name mapping */}
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">
                            Patient's country <span className="text-gray-400">(optional — shows local drug names)</span>
                          </label>
                          <select
                            value={aiCountry}
                            onChange={(e) => setAiCountry(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                          >
                            <option value="">— No mapping —</option>
                            <option value="IN">🇮🇳 India</option>
                            <option value="US">🇺🇸 USA</option>
                            <option value="GB">🇬🇧 United Kingdom</option>
                            <option value="AE">🇦🇪 UAE / Dubai</option>
                            <option value="DE">🇩🇪 Germany</option>
                            <option value="AU">🇦🇺 Australia</option>
                            <option value="CA">🇨🇦 Canada</option>
                            <option value="FR">🇫🇷 France</option>
                            <option value="SA">🇸🇦 Saudi Arabia</option>
                          </select>
                        </div>

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
                  {!patientId && patients.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-amber-500">← tap to select</span>
                  )}
                  {patientId && (
                    <span className="ml-2 text-xs font-normal text-green-600">✓ Selected</span>
                  )}
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
                          <Label className="text-xs text-gray-500 mb-1 flex items-center">
                            Medicine Name *
                            {getFieldConf(med.id, "medication") !== null && (
                              <ConfBadge score={getFieldConf(med.id, "medication")!} />
                            )}
                          </Label>
                          <Input
                            placeholder="e.g. Paracetamol"
                            value={med.medication}
                            onChange={(e) => updateMed(med.id, "medication", e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500 mb-1 flex items-center">
                            Dosage &amp; Frequency
                            {getFieldConf(med.id, "dosage") !== null && (
                              <ConfBadge score={getFieldConf(med.id, "dosage")!} />
                            )}
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
                        <Label className="text-xs text-gray-500 mb-1 flex items-center">
                          Instructions
                          {getFieldConf(med.id, "instructions") !== null && (
                            <ConfBadge score={getFieldConf(med.id, "instructions")!} />
                          )}
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

        {/* Dose warnings — WHO limit checks from ML API */}
        {aiDoseWarnings.some((dw: any) => dw.warnings?.length > 0) && (
          <div className="px-6 pb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Dose Warnings
            </p>
            {aiDoseWarnings.map((dw: any, di: number) =>
              (dw.warnings || []).map((w: any, wi: number) => (
                <div
                  key={`${di}-${wi}`}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    w.severity === "high"
                      ? "bg-red-50 border-red-200 text-red-800"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <span className="font-semibold mr-1">
                    {w.severity === "high" ? "⛔ HIGH" : "⚠ MODERATE"}
                  </span>
                  {w.message}
                  <div className="mt-1 opacity-60">{w.who_limit} · {w.source}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Drug name mappings — shown when country was selected */}
        {aiDrugMappings.length > 0 && (
          <div className="px-6 pb-4">
            <div className="rounded-xl border border-green-200 overflow-hidden">
              <div className="bg-green-50 px-4 py-2 border-b border-green-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                  Local Drug Names
                </p>
              </div>
              <div className="divide-y divide-green-100">
                {aiDrugMappings.map((m: any, i: number) => (
                  <div key={i} className="px-4 py-2.5 text-xs flex items-start gap-2 bg-white">
                    <div className="flex-1">
                      <span className="font-semibold text-gray-700">{m.source_name}</span>
                      {m.mapped && m.local_name !== m.source_name && (
                        <span className="text-green-700"> → <span className="font-semibold">{m.local_name}</span></span>
                      )}
                      {m.brand_examples?.length > 0 && (
                        <span className="text-gray-400 ml-1">({m.brand_examples.slice(0, 3).join(", ")})</span>
                      )}
                      {m.note && <div className="text-amber-600 mt-0.5">{m.note}</div>}
                    </div>
                    <span className="text-gray-400 shrink-0">{m.country_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Drug-interaction warnings — shown after AI extraction */}
        {aiInteractions !== null && aiInteractions.length > 0 && (
          <div className="px-6 pb-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Drug Interactions Detected
            </p>
            {aiInteractions.map((ix, i) => {
              const isHigh = ix.severity === "high";
              const isMod  = ix.severity === "moderate";
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    isHigh
                      ? "bg-red-50 border-red-200 text-red-800"
                      : isMod
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-blue-50 border-blue-200 text-blue-800"
                  }`}
                >
                  <span className="font-semibold mr-1">
                    {isHigh ? "⚠ HIGH" : isMod ? "△ MODERATE" : "ℹ LOW"}
                  </span>
                  <span className="font-semibold">{ix.drugs?.join(" + ")}: </span>
                  {ix.description}
                </div>
              );
            })}
          </div>
        )}

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
