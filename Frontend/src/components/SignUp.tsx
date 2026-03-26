import { useState } from "react";
import { API_BASE } from "../lib/config";
import { AuthHeader } from "./AuthHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { Mail, Lock, Eye, EyeOff, User, Stethoscope, UserRound } from "lucide-react";
import { motion } from "motion/react";

interface SignUpProps {
  onNavigateHome: () => void;
  onNavigateSignIn: () => void;
  onSignUp: (role: 'patient' | 'doctor') => void;
}

export function SignUp({ onNavigateHome, onNavigateSignIn, onSignUp }: SignUpProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "patient" as "patient" | "doctor",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const getPasswordStrength = (password: string) => {
    if (password.length === 0) return { strength: 0, text: "" };
    if (password.length < 6) return { strength: 1, text: "Weak", color: "bg-red-500" };
    if (password.length < 10) return { strength: 2, text: "Fair", color: "bg-yellow-500" };
    if (password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { strength: 3, text: "Strong", color: "bg-green-500" };
    }
    return { strength: 2, text: "Fair", color: "bg-yellow-500" };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Passwords don't match!");
      return;
    }

    if (formData.password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/signup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          email:    formData.email,
          password: formData.password,
          fullName: formData.fullName,
          role:     formData.role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user",  JSON.stringify(data.user));
        onSignUp(data.user.role);
      } else {
        setErrorMsg(data.error || "Sign up failed. Please try again.");
      }
    } catch {
      setErrorMsg("Cannot reach the server. Make sure the backend is running on port 5000.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-white relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1708596082257-d86701b84cec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWRpY2FsJTIwaGVhbHRoY2FyZSUyMGFic3RyYWN0JTIwYmFja2dyb3VuZHxlbnwxfHx8fDE3NTkwNzA4MzZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      />

      <AuthHeader onLogoClick={onNavigateHome} />

      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl mb-2">Create Your Account</CardTitle>
              <CardDescription className="text-gray-600">
                Join thousands of users taking charge of their health.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ── Role Selection ── */}
                <div className="space-y-2">
                  <Label>I am signing up as</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: "patient" })}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        formData.role === "patient"
                          ? "border-[#008080] bg-[#008080]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <UserRound className={`w-6 h-6 mb-1 ${formData.role === "patient" ? "text-[#008080]" : "text-gray-400"}`} />
                      <span className={`text-sm font-semibold ${formData.role === "patient" ? "text-[#008080]" : "text-gray-600"}`}>Patient</span>
                      <span className="text-xs text-gray-400 mt-0.5">Book appointments</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: "doctor" })}
                      className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                        formData.role === "doctor"
                          ? "border-[#008080] bg-[#008080]/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Stethoscope className={`w-6 h-6 mb-1 ${formData.role === "doctor" ? "text-[#008080]" : "text-gray-400"}`} />
                      <span className={`text-sm font-semibold ${formData.role === "doctor" ? "text-[#008080]" : "text-gray-600"}`}>Doctor</span>
                      <span className="text-xs text-gray-400 mt-0.5">Manage patients</span>
                    </button>
                  </div>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="pl-10 h-12"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Create a strong password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="pl-10 pr-10 h-12"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="space-y-1">
                      <div className="flex space-x-1">
                        {[1, 2, 3].map((level) => (
                          <div key={level} className={`h-1 flex-1 rounded ${passwordStrength.strength >= level ? passwordStrength.color : "bg-gray-200"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">Password strength: {passwordStrength.text}</p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className="pl-10 pr-10 h-12"
                      required
                    />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-xs text-red-500">Passwords don't match</p>
                  )}
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
                    {errorMsg}
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white rounded-lg"
                >
                  {isLoading ? "Creating Account..." : `Sign Up as ${formData.role === "patient" ? "Patient" : "Doctor"}`}
                </Button>
              </form>

              <div className="relative">
                <Separator />
                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-sm text-gray-500">OR</span>
              </div>

              <div className="text-center">
                <span className="text-gray-600">Already have an account? </span>
                <Button variant="link" onClick={onNavigateSignIn} className="text-blue-600 hover:text-blue-700 p-0">
                  Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}