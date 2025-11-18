import { useState } from 'react';
import { OnboardingData } from '../App';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';

type Props = {
  userName: string;
  onComplete: (data: OnboardingData) => void;
};

export function OnboardingScreen({ userName, onComplete }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Partial<OnboardingData>>({});

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/server/user/${encodeURIComponent(userName)}/onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(answers),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        onComplete(answers as OnboardingData);
      }
    } catch (err) {
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isStepComplete = () => {
    switch (step) {
      case 1:
        return !!answers.pythonExperience;
      case 2:
        return !!answers.experienceLevel;
      case 3:
        return !!answers.goal;
      case 4:
        return !!answers.theme;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl">Let's personalize your learning</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="w-4 h-4" />
              Step {step} of {totalSteps}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="p-8 bg-white shadow-xl border-gray-100">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">How long have you been coding in Python?</h2>
                <p className="text-gray-600">This helps us tailor the experience to your level</p>
              </div>

              <RadioGroup
                value={answers.pythonExperience}
                onValueChange={(value) => setAnswers({ ...answers, pythonExperience: value })}
              >
                <div className="space-y-3">
                  {['Just starting out', '1-3 months', '3-6 months', '6+ months'].map((option) => (
                    <label
                      key={option}
                      className="flex items-center space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="cursor-pointer flex-1">
                        {option}
                      </Label>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">What's your experience level?</h2>
                <p className="text-gray-600">Be honest - we'll adjust to your pace!</p>
              </div>

              <RadioGroup
                value={answers.experienceLevel}
                onValueChange={(value) => setAnswers({ ...answers, experienceLevel: value })}
              >
                <div className="space-y-3">
                  {[
                    { value: 'never', label: "Never touched code", desc: "Complete beginner" },
                    { value: 'basic', label: "Some experience", desc: "I know lists, variables, and loops" },
                    { value: 'intermediate', label: "Intermediate", desc: "I understand classes and OOP" },
                    { value: 'advanced', label: "Advanced", desc: "I work with different libraries" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">What's your goal?</h2>
                <p className="text-gray-600">What brings you to Edvance?</p>
              </div>

              <RadioGroup
                value={answers.goal}
                onValueChange={(value) => setAnswers({ ...answers, goal: value })}
              >
                <div className="space-y-3">
                  {[
                    'Learn programming fundamentals',
                    'Build projects for my portfolio',
                    'Prepare for a career in tech',
                    'Just exploring and having fun',
                  ].map((option) => (
                    <label
                      key={option}
                      className="flex items-center space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option} id={option} />
                      <Label htmlFor={option} className="cursor-pointer flex-1">
                        {option}
                      </Label>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">Choose your theme</h2>
                <p className="text-gray-600">Your lessons will be tailored to this theme (you can still create custom projects!)</p>
              </div>

              <RadioGroup
                value={answers.theme}
                onValueChange={(value) => setAnswers({ ...answers, theme: value })}
              >
                <div className="space-y-3">
                  {[
                    { value: 'chatbot', label: '🤖 Chatbots & AI', desc: 'Build conversational AI and intelligent bots' },
                    { value: 'gaming', label: '🎮 Gaming', desc: 'Create fun games and interactive experiences' },
                    { value: 'finance', label: '💰 Finance & Budgeting', desc: 'Develop budget trackers and financial tools' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="cursor-pointer">
                          {option.label}
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              onClick={handleBack}
              variant="ghost"
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={!isStepComplete() || loading}
              className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
            >
              {step === totalSteps ? (loading ? 'Saving...' : 'Complete') : 'Next'}
              {step < totalSteps && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
