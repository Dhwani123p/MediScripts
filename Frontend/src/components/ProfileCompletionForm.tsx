import { useState } from "react";
import { AuthHeader } from "./AuthHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";
import { User, Heart, FileText, Upload, Calendar, MapPin, Phone } from "lucide-react";
import { motion } from "motion/react";

interface ProfileCompletionFormProps {
  onNavigateHome: () => void;
  onComplete: () => void;
}

export function ProfileCompletionForm({ onNavigateHome, onComplete }: ProfileCompletionFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Personal Info
    age: "",
    gender: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    
    // Medical Info
    allergies: "",
    chronicConditions: "",
    currentMedications: "",
    bloodType: "",
    emergencyContact: "",
    emergencyPhone: "",
    
    // Past Medical History
    surgeries: "",
    hospitalizations: "",
    diagnoses: "",
    familyHistory: "",
    
    // Documents
    uploadedDocs: [] as File[]
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData({ ...formData, uploadedDocs: [...formData.uploadedDocs, ...files] });
  };

  const removeFile = (index: number) => {
    const newDocs = formData.uploadedDocs.filter((_, i) => i !== index);
    setFormData({ ...formData, uploadedDocs: newDocs });
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const steps = [
    { number: 1, title: "Personal Info", icon: User },
    { number: 2, title: "Medical Info", icon: Heart },
    { number: 3, title: "Medical History", icon: Calendar },
    { number: 4, title: "Documents", icon: FileText }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="Enter your age"
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value})}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="address"
                  type="text"
                  placeholder="Enter your address"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="pl-10 h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="City"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
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
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  type="text"
                  placeholder="ZIP"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({...formData, zipCode: e.target.value})}
                  className="h-12"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                placeholder="List any allergies you have (food, medication, environmental, etc.)"
                value={formData.allergies}
                onChange={(e) => setFormData({...formData, allergies: e.target.value})}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chronicConditions">Chronic Conditions</Label>
              <Textarea
                id="chronicConditions"
                placeholder="List any chronic conditions (diabetes, hypertension, asthma, etc.)"
                value={formData.chronicConditions}
                onChange={(e) => setFormData({...formData, chronicConditions: e.target.value})}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentMedications">Current Medications</Label>
              <Textarea
                id="currentMedications"
                placeholder="List all medications you are currently taking (name, dosage, frequency)"
                value={formData.currentMedications}
                onChange={(e) => setFormData({...formData, currentMedications: e.target.value})}
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bloodType">Blood Type</Label>
                <Select value={formData.bloodType} onValueChange={(value) => setFormData({...formData, bloodType: value})}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select blood type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Contact Name</Label>
                  <Input
                    id="emergencyContact"
                    type="text"
                    placeholder="Emergency contact name"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Contact Phone</Label>
                  <Input
                    id="emergencyPhone"
                    type="tel"
                    placeholder="Emergency contact phone"
                    value={formData.emergencyPhone}
                    onChange={(e) => setFormData({...formData, emergencyPhone: e.target.value})}
                    className="h-12"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="surgeries">Past Surgeries</Label>
              <Textarea
                id="surgeries"
                placeholder="List any past surgeries with approximate dates (e.g., Appendectomy - 2020)"
                value={formData.surgeries}
                onChange={(e) => setFormData({...formData, surgeries: e.target.value})}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hospitalizations">Past Hospitalizations</Label>
              <Textarea
                id="hospitalizations"
                placeholder="List any significant hospitalizations with dates and reasons"
                value={formData.hospitalizations}
                onChange={(e) => setFormData({...formData, hospitalizations: e.target.value})}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnoses">Past Diagnoses</Label>
              <Textarea
                id="diagnoses"
                placeholder="List any significant medical diagnoses with dates"
                value={formData.diagnoses}
                onChange={(e) => setFormData({...formData, diagnoses: e.target.value})}
                className="min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="familyHistory">Family Medical History</Label>
              <Textarea
                id="familyHistory"
                placeholder="List any significant family medical history (heart disease, diabetes, cancer, etc.)"
                value={formData.familyHistory}
                onChange={(e) => setFormData({...formData, familyHistory: e.target.value})}
                className="min-h-[80px]"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Medical Documents</Label>
              <p className="text-sm text-gray-600">
                Upload lab reports, prescriptions, medical scans, or other relevant documents (PDF, JPG, PNG)
              </p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <span className="mt-2 block text-sm text-gray-900">
                    Click to upload or drag and drop
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    PDF, PNG, JPG up to 10MB each
                  </span>
                </label>
                <input
                  id="file-upload"
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
                        <span className="text-xs text-gray-500">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-600 hover:text-red-700"
                      >
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
                You can add more documents later from your profile page.
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
              <CardTitle className="text-2xl mb-2">Complete Your Profile</CardTitle>
              <CardDescription className="text-gray-600">
                Help us provide you with personalized care by completing your medical profile.
              </CardDescription>
              
              {/* Progress Steps */}
              <div className="flex items-center justify-center space-x-4 mt-6">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center">
                    <div className={`
                      flex items-center justify-center w-10 h-10 rounded-full border-2 
                      ${currentStep >= step.number 
                        ? 'bg-[#008080] border-[#008080] text-white' 
                        : 'border-gray-300 text-gray-400'
                      }
                    `}>
                      <step.icon className="w-5 h-5" />
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`
                        w-8 h-0.5 mx-2 
                        ${currentStep > step.number ? 'bg-[#008080]' : 'bg-gray-300'}
                      `} />
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
                  className="h-12 px-6 bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white"
                >
                  {currentStep === steps.length ? 'Complete Profile' : 'Next'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}