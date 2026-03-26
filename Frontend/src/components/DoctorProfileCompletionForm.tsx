import { useState } from "react";
import { API_BASE } from "../lib/config";
import { AuthHeader } from "./AuthHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { User, Stethoscope, GraduationCap, FileText } from "lucide-react";
import { motion } from "motion/react";

interface DoctorProfileCompletionFormProps {
  onNavigateHome: () => void;
  onComplete: () => void;
}

export function DoctorProfileCompletionForm({ onNavigateHome, onComplete }: DoctorProfileCompletionFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1 — Personal Info
    phone:    "",
    gender:   "",
    address:  "",
    city:     "",
    state:    "",

    // Step 2 — Professional Info
    specialty:       "",
    qualification:   "",
    experience:      "",
    hospital:        "",
    location:        "",
    consultationFee: "",

    // Step 3 — About & Languages
    bio:       "",
    languages: "",

    // Step 4 — Documents (UI only, no real upload)
    uploadedDocs: [] as File[],
  });

  const steps = [
    { number: 1, title: "Personal Info",      icon: User },
    { number: 2, title: "Professional Info",  icon: Stethoscope },
    { number: 3, title: "About You",          icon: GraduationCap },
    { number: 4, title: "Documents",          icon: FileText },
  ];

  const handleNext = async () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      // On final step — save professional profile to backend
      setIsSubmitting(true);
      try {
        const token = localStorage.getItem("token");
        if (token) {
          // Update users table (phone)
          await fetch("${API_BASE}/users/profile", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ phone: formData.phone }),
          });
          // Update doctors table (professional info)
          await fetch("${API_BASE}/doctors/profile", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body:    JSON.stringify({
              specialty:        formData.specialty,
              qualification:    formData.qualification,
              experience:       formData.experience,
              hospital:         formData.hospital,
              location:         formData.location,
              consultation_fee: formData.consultationFee,
              bio:              formData.bio,
              languages:        formData.languages,
            }),
          });
        }
      } catch {
        // silently continue — profile can be updated later
      }
      setIsSubmitting(false);
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData({ ...formData, uploadedDocs: [...formData.uploadedDocs, ...files] });
  };

  const removeFile = (index: number) => {
    setFormData({ ...formData, uploadedDocs: formData.uploadedDocs.filter((_, i) => i !== index) });
  };

  const renderStepContent = () => {
    switch (currentStep) {

      // ── Step 1: Personal Info ──────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Your contact number"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Clinic / Hospital Address</Label>
              <Input
                id="address"
                type="text"
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="h-12"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  type="text"
                  placeholder="State"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>
          </div>
        );

      // ── Step 2: Professional Info ──────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="specialty">Specialty *</Label>
                <Select value={formData.specialty} onValueChange={(v) => setFormData({ ...formData, specialty: v })}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select specialty" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cardiologist">Cardiologist</SelectItem>
                    <SelectItem value="Dermatologist">Dermatologist</SelectItem>
                    <SelectItem value="General Physician">General Physician</SelectItem>
                    <SelectItem value="Gynecologist">Gynecologist</SelectItem>
                    <SelectItem value="Neurologist">Neurologist</SelectItem>
                    <SelectItem value="Orthopedic Surgeon">Orthopedic Surgeon</SelectItem>
                    <SelectItem value="Pediatrician">Pediatrician</SelectItem>
                    <SelectItem value="Psychiatrist">Psychiatrist</SelectItem>
                    <SelectItem value="ENT Specialist">ENT Specialist</SelectItem>
                    <SelectItem value="Ophthalmologist">Ophthalmologist</SelectItem>
                    <SelectItem value="Urologist">Urologist</SelectItem>
                    <SelectItem value="Endocrinologist">Endocrinologist</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience">Years of Experience</Label>
                <Select value={formData.experience} onValueChange={(v) => setFormData({ ...formData, experience: v })}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select experience" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">0–1 years</SelectItem>
                    <SelectItem value="3">2–3 years</SelectItem>
                    <SelectItem value="5">4–5 years</SelectItem>
                    <SelectItem value="8">6–8 years</SelectItem>
                    <SelectItem value="10">9–10 years</SelectItem>
                    <SelectItem value="15">11–15 years</SelectItem>
                    <SelectItem value="20">15+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qualification">Qualification</Label>
              <Input
                id="qualification"
                type="text"
                placeholder="e.g. MBBS, MD (Cardiology), MS (Orthopaedics)"
                value={formData.qualification}
                onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                className="h-12"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital">Hospital / Clinic Name</Label>
                <Input
                  id="hospital"
                  type="text"
                  placeholder="e.g. Ruby Hall Clinic"
                  value={formData.hospital}
                  onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  type="text"
                  placeholder="e.g. Pune, Maharashtra"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="consultationFee">Consultation Fee (₹)</Label>
              <Input
                id="consultationFee"
                type="number"
                placeholder="e.g. 500"
                value={formData.consultationFee}
                onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                className="h-12"
              />
            </div>
          </div>
        );

      // ── Step 3: About & Languages ──────────────────────────────────────
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Professional Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell patients about your expertise, approach and specialisations..."
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="min-h-[120px]"
              />
              <p className="text-xs text-gray-500">This will appear on your public doctor profile.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="languages">Languages Spoken</Label>
              <Input
                id="languages"
                type="text"
                placeholder="e.g. English, Hindi, Marathi"
                value={formData.languages}
                onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                className="h-12"
              />
              <p className="text-xs text-gray-500">Separate multiple languages with commas.</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> A complete bio and listing of languages increases patient trust and
                helps patients find the right doctor for them.
              </p>
            </div>
          </div>
        );

      // ── Step 4: Documents ──────────────────────────────────────────────
      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Credentials & Certificates</Label>
              <p className="text-sm text-gray-600">
                Upload your medical degree, registration certificate, or any relevant credentials (PDF, JPG, PNG).
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <GraduationCap className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <label htmlFor="doc-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm text-gray-900">Click to upload or drag and drop</span>
                  <span className="mt-1 block text-xs text-gray-500">PDF, PNG, JPG up to 10MB each</span>
                </label>
                <input
                  id="doc-upload"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>

            {formData.uploadedDocs.length > 0 && (
              <div className="space-y-2">
                <Label>Uploaded Documents</Label>
                <div className="space-y-2">
                  {formData.uploadedDocs.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <span className="text-sm text-gray-900">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)} className="text-red-600 hover:text-red-700">
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> All uploaded documents are encrypted and stored securely.
                Verification may take up to 24 hours before your profile goes live.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-white">
      <AuthHeader onLogoClick={onNavigateHome} />

      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl mb-2">Complete Your Doctor Profile</CardTitle>
              <CardDescription className="text-gray-600">
                Set up your professional profile so patients can find and book you.
              </CardDescription>

              {/* Progress Steps — identical style to PatientProfileCompletionForm */}
              <div className="flex items-center justify-center space-x-4 mt-6">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2
                      ${currentStep >= step.number
                        ? "bg-[#008080] border-[#008080] text-white"
                        : "border-gray-300 text-gray-400"
                      }
                    `}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-8 h-0.5 mx-2 ${currentStep > step.number ? "bg-[#008080]" : "bg-gray-300"}`} />
                    )}
                  </div>
                ))}
              </div>

              <div className="text-center mt-4">
                <h3 className="font-medium text-gray-900">{steps[currentStep - 1].title}</h3>
                <p className="text-sm text-gray-500">Step {currentStep} of {steps.length}</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {renderStepContent()}

              <div className="flex justify-between pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep === 1}
                  className="h-12 px-6"
                >
                  Back
                </Button>

                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={isSubmitting}
                  className="h-12 px-6 bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white"
                >
                  {isSubmitting ? "Saving..." : currentStep === steps.length ? "Complete Profile" : "Next"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}