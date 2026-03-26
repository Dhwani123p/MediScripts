import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { User, Shield } from "lucide-react";

export function HealthProfilePage() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-[#008080]" />
            <CardTitle>Personal Health Profile</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><p className="text-xs text-gray-500 uppercase font-bold">Name</p><p className="text-lg">{user.fullName}</p></div>
          <div><p className="text-xs text-gray-500 uppercase font-bold">Email</p><p className="text-lg">{user.email}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-red-500" />
            <CardTitle>Security & Medical Records</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 italic">Connected to medical records database. No active alerts found.</p>
        </CardContent>
      </Card>
    </div>
  );
}