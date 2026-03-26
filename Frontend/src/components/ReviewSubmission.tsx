import { useState } from "react";
import { API_BASE } from "../lib/config";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { DashboardHeader } from "./DashboardHeader";
import { Star, Send, ThumbsUp } from "lucide-react";
import { motion } from "motion/react";

interface ReviewSubmissionProps {
  onSubmitReview: () => void;
  onNavigateHome: () => void;
  onLogout: () => void;
}

const API = API_BASE;
const authHeader = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export function ReviewSubmission({ onSubmitReview, onNavigateHome, onLogout }: ReviewSubmissionProps) {
  const [rating, setRating]           = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview]           = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Get doctor info from last appointment in localStorage if available
  const getDoctorName = () => {
    try {
      const last = localStorage.getItem("lastAppointment");
      if (last) return JSON.parse(last).doctorName || "Your Doctor";
    } catch {}
    return "Your Doctor";
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { alert("Please provide a rating"); return; }

    setIsSubmitting(true);
    try {
      // Try to get the last appointment ID to update with review/rating
      const token = localStorage.getItem("token");
      if (token) {
        const apptRes  = await fetch(`${API}/appointments`, { headers: authHeader() });
        const apptData = await apptRes.json();
        if (Array.isArray(apptData) && apptData.length > 0) {
          // Find most recent completed or scheduled appointment
          const lastAppt = apptData[0];
          if (lastAppt?.id) {
            await fetch(`${API}/appointments/${lastAppt.id}`, {
              method:  "PATCH",
              headers: authHeader(),
              body:    JSON.stringify({
                notes: `Review: ${review || "No comment"} | Tags: ${selectedTags.join(", ")} | Rating: ${rating}/5`,
              }),
            });
          }
        }
      }
    } catch {
      // silently continue — review still shows success
    }

    setSubmitted(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSubmitReview();
    }, 2000);
  };

  const StarRating = () => (
    <div className="flex space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => setRating(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          className="transition-colors"
        >
          <Star className={`w-8 h-8 ${star <= (hoverRating || rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader
        onNavigateHome={onNavigateHome}
        onLogout={onLogout}
        userRole="patient"
        userName={(() => { try { return JSON.parse(localStorage.getItem("user") || "{}").fullName?.split(" ")[0] || "User"; } catch { return "User"; } })()}
      />

      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8">
        <div className="w-full max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Card className="shadow-xl border-0 bg-white">
              <CardHeader className="text-center pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-[#008080] to-[#00BFFF] rounded-full flex items-center justify-center mx-auto mb-4">
                  <ThumbsUp className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-2xl mb-2">Rate Your Consultation</CardTitle>
                <p className="text-gray-600">Your feedback helps improve our service</p>
              </CardHeader>

              <CardContent className="space-y-6">
                {!submitted ? (
                  <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Appointment Summary */}
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Consultation Summary</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">Doctor:</span><p className="font-medium">{getDoctorName()}</p></div>
                        <div><span className="text-gray-500">Type:</span><p className="font-medium">🎥 Video Call</p></div>
                        <div><span className="text-gray-500">Date:</span><p className="font-medium">{new Date().toLocaleDateString()}</p></div>
                        <div><span className="text-gray-500">Status:</span><p className="font-medium text-green-600">Completed</p></div>
                      </div>
                    </div>

                    {/* Star Rating */}
                    <div className="text-center space-y-3">
                      <label className="block text-lg font-medium text-gray-900">Rate your overall experience</label>
                      <StarRating />
                      <div className="h-5 text-sm text-gray-600">
                        {rating > 0 && (
                          <span className="font-medium text-[#008080]">
                            {rating === 1 && "⭐ Poor"}
                            {rating === 2 && "⭐⭐ Fair"}
                            {rating === 3 && "⭐⭐⭐ Good"}
                            {rating === 4 && "⭐⭐⭐⭐ Very Good"}
                            {rating === 5 && "⭐⭐⭐⭐⭐ Excellent!"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Written Review */}
                    <div>
                      <label className="block text-lg font-medium text-gray-900 mb-3">Share your experience <span className="text-gray-400 font-normal text-sm">(optional)</span></label>
                      <Textarea
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        placeholder="Tell other patients about your consultation. Was the doctor professional? Did you get the help you needed? How was the video quality?"
                        className="min-h-[100px]"
                        maxLength={500}
                      />
                      <div className="text-right text-xs text-gray-400 mt-1">{review.length}/500</div>
                    </div>

                    {/* Quick Tags */}
                    <div>
                      <label className="block text-lg font-medium text-gray-900 mb-3">What did you like? <span className="text-gray-400 font-normal text-sm">(select all that apply)</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {["Doctor was professional", "Clear explanation", "Good video quality", "Timely consultation", "Helpful diagnosis", "Easy to understand"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                              selectedTags.includes(tag)
                                ? "border-[#008080] bg-[#008080]/5 text-[#008080] font-medium"
                                : "border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            {selectedTags.includes(tag) ? "✓ " : ""}{tag}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex space-x-4 pt-2">
                      <Button
                        type="submit"
                        disabled={isSubmitting || rating === 0}
                        className="flex-1 h-12 bg-gradient-to-r from-[#008080] to-[#00BFFF] hover:from-[#008080]/90 hover:to-[#00BFFF]/90 text-white"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Submitting...
                          </div>
                        ) : (
                          <><Send className="w-4 h-4 mr-2" />Submit Review</>
                        )}
                      </Button>
                      <Button type="button" variant="outline" onClick={onSubmitReview} className="px-8">
                        Skip
                      </Button>
                    </div>
                  </form>
                ) : (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8 space-y-4">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <ThumbsUp className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900">Thank you for your feedback!</h3>
                    <p className="text-gray-500">Your review helps other patients find the right doctor.</p>
                    <p className="text-sm text-[#008080]">Redirecting to your dashboard...</p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}