import { useState, useEffect } from "react";
import { API_BASE } from "../lib/config";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { User, Shield, Heart, Phone, Save, Loader2, CheckCircle2 } from "lucide-react";

const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export function HealthProfilePage() {
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  })();

  const [form, setForm] = useState({
    date_of_birth: "", gender: "", blood_group: "",
    height_cm: "", weight_kg: "",
    allergies: "", current_medications: "", chronic_conditions: "",
    past_surgeries: "", family_history: "",
    emergency_contact_name: "", emergency_contact_phone: "",
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/health-profile`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        setForm(prev => ({
          ...prev,
          date_of_birth:           data.date_of_birth?.split("T")[0] || "",
          gender:                  data.gender                        || "",
          blood_group:             data.blood_group                   || "",
          height_cm:               data.height_cm?.toString()         || "",
          weight_kg:               data.weight_kg?.toString()         || "",
          allergies:               data.allergies                     || "",
          current_medications:     data.current_medications           || "",
          chronic_conditions:      data.chronic_conditions            || "",
          past_surgeries:          data.past_surgeries                || "",
          family_history:          data.family_history                || "",
          emergency_contact_name:  data.emergency_contact_name        || "",
          emergency_contact_phone: data.emergency_contact_phone       || "",
        }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true); setErrorMsg(""); setSaved(false);
    try {
      const res  = await fetch(`${API_BASE}/health-profile`, {
        method:  "PUT",
        headers: authHeader(),
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) { setErrorMsg(data.error); }
      else            { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    } catch {
      setErrorMsg("Could not save — check server connection.");
    }
    setSaving(false);
  };

  // Compute age from DOB
  const age = (() => {
    if (!form.date_of_birth) return null;
    const diff = Date.now() - new Date(form.date_of_birth).getTime();
    return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  })();

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-[#008080]" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">

      {/* ── Personal Info ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-[#008080]" />
            <CardTitle>Personal Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500 uppercase font-bold">Full Name</Label>
              <p className="text-base font-medium mt-1">{user.fullName || user.full_name || "—"}</p>
            </div>
            <div>
              <Label className="text-xs text-gray-500 uppercase font-bold">Email</Label>
              <p className="text-base font-medium mt-1">{user.email || "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="dob">Date of Birth {age !== null && <span className="text-[#008080] font-normal">· {age} yrs</span>}</Label>
              <Input id="dob" type="date" value={form.date_of_birth}
                onChange={e => set("date_of_birth", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {["Male","Female","Non-binary","Prefer not to say"].map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Blood Group</Label>
              <Select value={form.blood_group} onValueChange={v => set("blood_group", v)}>
                <SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="height">Height (cm)</Label>
              <Input id="height" type="number" placeholder="e.g. 170"
                value={form.height_cm} onChange={e => set("height_cm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" type="number" placeholder="e.g. 65"
                value={form.weight_kg} onChange={e => set("weight_kg", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Medical History ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Heart className="w-5 h-5 text-red-500" />
            <CardTitle>Medical History</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="allergies">
              Allergies
              <span className="text-xs text-red-500 ml-1 font-normal">(Important — seen by doctors)</span>
            </Label>
            <Textarea id="allergies" placeholder="e.g. Penicillin, Peanuts, Dust mites"
              value={form.allergies} onChange={e => set("allergies", e.target.value)}
              className="min-h-[70px]" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="current_meds">Current Medications</Label>
            <Textarea id="current_meds"
              placeholder="e.g. Metformin 500mg twice daily, Vitamin D3 1000IU"
              value={form.current_medications}
              onChange={e => set("current_medications", e.target.value)}
              className="min-h-[70px]" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="chronic">Chronic Conditions / Diagnoses</Label>
            <Textarea id="chronic"
              placeholder="e.g. Type 2 Diabetes, Hypertension, Asthma"
              value={form.chronic_conditions}
              onChange={e => set("chronic_conditions", e.target.value)}
              className="min-h-[70px]" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="surgeries">Past Surgeries / Hospitalizations</Label>
            <Textarea id="surgeries"
              placeholder="e.g. Appendectomy 2018, Knee replacement 2021"
              value={form.past_surgeries}
              onChange={e => set("past_surgeries", e.target.value)}
              className="min-h-[70px]" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="family">Family Medical History</Label>
            <Textarea id="family"
              placeholder="e.g. Father - Heart disease, Mother - Diabetes"
              value={form.family_history}
              onChange={e => set("family_history", e.target.value)}
              className="min-h-[70px]" />
          </div>
        </CardContent>
      </Card>

      {/* ── Emergency Contact ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Phone className="w-5 h-5 text-orange-500" />
            <CardTitle>Emergency Contact</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="ec_name">Contact Name</Label>
            <Input id="ec_name" placeholder="e.g. Raj Sharma"
              value={form.emergency_contact_name}
              onChange={e => set("emergency_contact_name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ec_phone">Contact Phone</Label>
            <Input id="ec_phone" placeholder="e.g. +91 98765 43210"
              value={form.emergency_contact_phone}
              onChange={e => set("emergency_contact_phone", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── Save button ── */}
      {errorMsg && <p className="text-red-500 text-sm text-center">{errorMsg}</p>}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}
          className="bg-[#008080] hover:bg-[#008080]/90 px-8">
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4 mr-2" />Saved!</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Save Health Profile</>
          )}
        </Button>
      </div>
    </div>
  );
}
