import { Bell, Heart, Search, User } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";

interface DashboardHeaderProps {
  userName: string;
  userRole: "patient" | "doctor";
  onLogout: () => void;
  onNavigateHome: () => void;
}

export function DashboardHeader({ userName, userRole, onLogout, onNavigateHome }: DashboardHeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <button 
          onClick={onNavigateHome}
          className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-teal-500 rounded-xl flex items-center justify-center">
            <Heart size={24} className="text-white" />
          </div>
          <span className="text-2xl text-gray-900">Mediscript</span>
        </button>

        {/* Search Bar - Hidden on mobile */}
        <div className="hidden md:flex items-center space-x-4 flex-1 max-w-md mx-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder={userRole === "patient" ? "Search doctors, symptoms..." : "Search patients, prescriptions..."}
              className="pl-10"
            />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="w-5 h-5" />
            <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-red-500 text-white text-xs">
              3
            </Badge>
          </Button>

          {/* User Profile */}
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} />
              <AvatarFallback>
                <User className="w-5 h-5" />
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block">
              <p className="text-sm text-gray-900">{userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole}</p>
            </div>
          </div>

          {/* Logout */}
          <Button variant="outline" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}