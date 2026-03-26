import { useState } from "react";
import { API_BASE } from "../lib/config";
import { AuthHeader } from "./AuthHeader";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Separator } from "./ui/separator";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { motion } from "motion/react";
import { authAPI } from "../services/api";

interface SignInProps {
  onNavigateHome: () => void;
  onNavigateSignUp: () => void;
  onSignIn: (role: "patient" | "doctor") => void;
}

export function SignIn({
  onNavigateHome,
  onNavigateSignUp,
  onSignIn,
}: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
    role: "patient" as "patient" | "doctor",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setIsLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/signin`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: formData.email, password: formData.password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user",  JSON.stringify(data.user));
        onSignIn(data.user.role);
      } else {
        setErrorMsg(data.error || "Invalid email or password");
      }
    } catch {
      setErrorMsg("Cannot reach the server. Make sure the backend is running on port 5000.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-white relative overflow-hidden">
      {/* Background Pattern */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1708596082257-d86701b84cec')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <AuthHeader onLogoClick={onNavigateHome} />

      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          <Card className="shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</CardTitle>
              <CardDescription className="text-gray-600">
                Log in to continue your care journey.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className="pl-10 h-12 focus:ring-[#008080]"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pl-10 pr-10 h-12 focus:ring-[#008080]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#008080] transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Role Selection */}
                <div className="space-y-2">
                  <Label htmlFor="role">Sign in as</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as "patient" | "doctor",
                        })
                      }
                      className="w-full border border-gray-200 rounded-lg pl-10 pr-4 h-12 bg-white focus:outline-none focus:ring-2 focus:ring-[#008080] appearance-none cursor-pointer"
                    >
                      <option value="patient">Patient</option>
                      <option value="doctor">Doctor</option>
                    </select>
                  </div>
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={formData.rememberMe}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, rememberMe: !!checked })
                      }
                    />
                    <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer select-none">
                      Remember Me
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm text-[#008080] hover:text-[#006666] p-0 h-auto"
                  >
                    Forgot Password?
                  </Button>
                </div>

                {/* Sign In Button */}
                {errorMsg && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2">
                    {errorMsg}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white rounded-lg"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative py-2">
                <Separator />
                <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-gray-500 font-medium uppercase tracking-wider">
                  OR
                </span>
              </div>

              {/* Sign Up Link */}
              <div className="text-center">
                <span className="text-gray-600 text-sm">New here? </span>
                <Button
                  type="button"
                  variant="link"
                  onClick={onNavigateSignUp}
                  className="text-[#008080] hover:text-[#006666] p-0 h-auto text-sm font-bold"
                >
                  Create an account
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}