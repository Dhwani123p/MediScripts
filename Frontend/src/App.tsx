import { DoctorProfileCompletionForm } from "./components/DoctorProfileCompletionForm";
import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { HeroSection } from "./components/HeroSection";
import { FeaturesSection } from "./components/FeaturesSection";
import { AboutSection } from "./components/AboutSection";
import { HowItWorksSection } from "./components/HowItWorksSection";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { DoctorsSection } from "./components/DoctorsSection";
import { Footer } from "./components/Footer";
import { SignIn } from "./components/SignIn";
import { SignUp } from "./components/SignUp";
import { LoadingScreen } from "./components/LoadingScreen";
import { PatientDashboard } from "./components/PatientDashboard";
import { DoctorDashboard } from "./components/DoctorDashboard";
import { VideoConferencePatient } from "./components/VideoConferencePatient";
import { VideoConferenceDoctor } from "./components/VideoConferenceDoctor";
import { ReviewSubmission } from "./components/ReviewSubmission";
import { ProfileCompletionForm } from "./components/ProfileCompletionForm";
import { DoctorsListPage } from "./components/DoctorsListPage";
import { AppointmentsPage } from "./components/AppointmentsPage";

type Page = 'home' | 'signin' | 'signup' | 'loading' | 'profile-completion' | 'patient-dashboard' | 'doctor-dashboard' | 'video-conference-patient' | 'video-conference-doctor' | 'review-submission' | 'doctors-list' | 'appointments';
type UserRole = 'patient' | 'doctor' | null;

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentRoom, setCurrentRoom] = useState<string>("");

  // Restore session from localStorage on initial load
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        const role = user.role as UserRole;
        setUserRole(role);
        setCurrentPage(role === 'doctor' ? 'doctor-dashboard' : 'patient-dashboard');
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleSignIn = (role: UserRole) => {
    setUserRole(role);
    setCurrentPage('loading');
  };

  const handleSignUp = (role: UserRole) => {
    setUserRole(role);
    setCurrentPage('profile-completion');
  };

  const handleLoadingComplete = () => {
    if (userRole === 'patient') {
      setCurrentPage('patient-dashboard');
    } else if (userRole === 'doctor') {
      setCurrentPage('doctor-dashboard');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUserRole(null);
    setCurrentPage('home');
  };

  const handleStartVideoCall = (roomName?: string) => {
    // Use passed room name, or default shared room
    setCurrentRoom(roomName || "MediScript-LiveConsult");
    if (userRole === 'patient') {
      setCurrentPage('video-conference-patient');
    } else if (userRole === 'doctor') {
      setCurrentPage('video-conference-doctor');
    }
  };

  const handleEndCallPatient = () => {
    setCurrentPage('review-submission');
  };

  const handleEndCallDoctor = () => {
    setCurrentPage('doctor-dashboard');
  };

  const handleReviewSubmitted = () => {
    setCurrentPage('patient-dashboard');
  };

  const handleProfileCompleted = () => {
    setCurrentPage('loading');
  };

  const handleBookAppointment = (_doctorId?: number) => {
    // Patients go to the doctors list to pick a doctor and book
    setCurrentPage('doctors-list');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'signin':
        return (
          <SignIn 
            onNavigateHome={() => setCurrentPage('home')}
            onNavigateSignUp={() => setCurrentPage('signup')}
            onSignIn={handleSignIn}
          />
        );
      case 'signup':
        return (
          <SignUp 
            onNavigateHome={() => setCurrentPage('home')}
            onNavigateSignIn={() => setCurrentPage('signin')}
            onSignUp={handleSignUp}
          />
        );
      case 'profile-completion':
        return userRole === 'doctor' ? (
          <DoctorProfileCompletionForm
          onNavigateHome={() => setCurrentPage('home')}
          onComplete={handleProfileCompleted}
          />
        ) : (
          <ProfileCompletionForm
          onNavigateHome={() => setCurrentPage('home')}
          onComplete={handleProfileCompleted}
          />
        );

      case 'loading':
        return (
          <LoadingScreen onComplete={handleLoadingComplete} />
        );
      case 'patient-dashboard':
        return (
          <PatientDashboard
            onLogout={handleLogout}
            onNavigateHome={() => setCurrentPage('home')}
            onStartVideoCall={handleStartVideoCall}
            onViewDoctors={() => setCurrentPage('doctors-list')}
            onViewAppointments={() => setCurrentPage('appointments')}
          />
        );
      case 'doctor-dashboard':
        return (
          <DoctorDashboard 
            onLogout={handleLogout}
            onNavigateHome={() => setCurrentPage('home')}
            onStartVideoCall={handleStartVideoCall}
          />
        );
      case 'video-conference-patient':
        return (
          <VideoConferencePatient
            roomName={currentRoom}
            onEndCall={handleEndCallPatient}
            onNavigateHome={() => setCurrentPage('home')}
            onLogout={handleLogout}
          />
        );
      case 'video-conference-doctor':
        return (
          <VideoConferenceDoctor
            roomName={currentRoom}
            onEndCall={handleEndCallDoctor}
            onNavigateHome={() => setCurrentPage('home')}
            onLogout={handleLogout}
          />
        );
      case 'review-submission':
        return (
          <ReviewSubmission
            onSubmitReview={handleReviewSubmitted}
            onNavigateHome={() => setCurrentPage('home')}
            onLogout={handleLogout}
          />
        );
      case 'doctors-list':
        return (
          <DoctorsListPage
            onBack={() => setCurrentPage(userRole === 'patient' ? 'patient-dashboard' : 'doctor-dashboard')}
            onBookAppointment={handleBookAppointment}
            onJoinCall={handleStartVideoCall}
            onViewDetails={(doctorId) => console.log('View details for doctor', doctorId)}
          />
        );
      case 'appointments':
        return (
          <AppointmentsPage
            onBack={() => setCurrentPage(userRole === 'patient' ? 'patient-dashboard' : 'doctor-dashboard')}
            onJoinCall={handleStartVideoCall}
          />
        );
      default:
        return (
          <div className="min-h-screen bg-white">
            <Header 
              onNavigateSignIn={() => setCurrentPage('signin')}
              onNavigateSignUp={() => setCurrentPage('signup')}
              onNavigateAbout={() => {
                const aboutSection = document.getElementById('about');
                if (aboutSection) {
                  aboutSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              onBookAppointment={() => setCurrentPage('signin')}
            />
            <div className="pt-16">
              <HeroSection onBookAppointment={() => setCurrentPage('signin')} />
              <FeaturesSection />
              <AboutSection />
              <HowItWorksSection />
              <TestimonialsSection />
              <DoctorsSection onViewAllDoctors={() => setCurrentPage('signin')} />
              <Footer />
            </div>
          </div>
        );
    }
  };

  return renderPage();
}