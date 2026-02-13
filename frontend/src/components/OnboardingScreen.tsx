import { useState } from 'react';
import { OnboardingData, User } from '../App';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { ArrowRight, ArrowLeft, Sparkles, GraduationCap, BookOpen } from 'lucide-react';
import { authFetch } from '../utils/authFetch';

type Props = {
  user: User;
  onComplete: (data: OnboardingData, role?: 'student' | 'teacher') => void;
};

export function OnboardingScreen({ user, onComplete }: Props) {
  const [step, setStep] = useState(0); // Step 0 = role selection
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [answers, setAnswers] = useState<Partial<OnboardingData>>({});

  const totalSteps = role === 'teacher' ? 1 : 6; // Role step + 5 student steps
  const progress = ((step + 1) / totalSteps) * 100;

  const handleNext = () => {
    // Step 0 = role selection
    if (step === 0 && role === 'teacher') {
      // Teachers skip student-specific steps
      handleSubmit();
      return;
    }
    const maxStep = role === 'teacher' ? 0 : 5;
    if (step < maxStep) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    if (!isStepComplete()) {
      console.error("Attempted submission before all steps were complete.");
      setLoading(false);
      return;
    }

    const onboardingData = role === 'teacher'
      ? { educationLevel: 'teacher', schoolExperience: 'teacher', pythonLevel: 'teacher', biggestChallenges: [], learningMode: 'teacher' }
      : answers;

    try {
      const response = await authFetch(
        '/users/onboarding',
        {
          method: 'POST',
          body: JSON.stringify({
            onboardingData,
            role,
          }),
        }
      );

      const data = await response.json();

      if (data.success) {
        onComplete(onboardingData as OnboardingData, role);
      } else {
        console.error('Backend failed to save onboarding data:', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Onboarding network error:', err);
    } finally {
      setLoading(false);
    }
  };

  const isStepComplete = () => {
    switch (step) {
      case 0:
        return !!role;
      case 1:
        return !!answers.educationLevel;
      case 2:
        return !!answers.schoolExperience;
      case 3:
        return !!answers.pythonLevel;
      case 4:
        return (answers.biggestChallenges?.length ?? 0) > 0;
      case 5:
        return !!answers.learningMode;
      default:
        return false;
    }
  };

  const toggleChallenge = (value: string) => {
    const current = answers.biggestChallenges || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setAnswers({ ...answers, biggestChallenges: updated });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50 p-4 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl">Hello, {user.name}! Let's personalize your experience</h1>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="w-4 h-4" />
              Step {step + 1} of {totalSteps}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="p-8 bg-white shadow-xl border-gray-100">
          {/* Step 0: Role Selection */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">I am a...</h2>
                <p className="text-gray-600">Choose your role to get the right experience</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRole('student')}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${
                    role === 'student'
                      ? 'border-[#7622e5] bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-[#7622e5]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center mb-3">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Student</h3>
                  <p className="text-sm text-gray-500">Learn to code through guided projects</p>
                </button>

                <button
                  onClick={() => setRole('teacher')}
                  className={`p-6 rounded-xl border-2 transition-all text-left ${
                    role === 'teacher'
                      ? 'border-[#7622e5] bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-[#7622e5]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffa200] to-[#ff8800] flex items-center justify-center mb-3">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Teacher</h3>
                  <p className="text-sm text-gray-500">Create classrooms and track student progress</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Educational Level */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">What is your current level?</h2>
                <p className="text-gray-600">This helps us give you the right level of support</p>
              </div>

              <RadioGroup
                value={answers.educationLevel}
                onValueChange={(value: string) => setAnswers({ ...answers, educationLevel: value })}
              >
                <div className="space-y-3">
                  {[
                    { value: 'primary', label: 'Primary 5 / Primary 6', desc: 'Upper primary school student' },
                    { value: 'lower-sec', label: 'Lower Secondary (Sec 1 - Sec 2)', desc: 'Just started secondary school' },
                    { value: 'upper-sec', label: 'Upper Secondary (Sec 3 - Sec 5)', desc: 'Preparing for O/N Levels' },
                    { value: 'post-sec', label: 'Junior College / MI / Poly / ITE', desc: 'Post-secondary education' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="cursor-pointer font-medium">
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

          {/* Step 2: School Coding Experience */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">What's the most advanced coding you've done in school?</h2>
                <p className="text-gray-600">Pick the one that best describes your experience</p>
              </div>

              <RadioGroup
                value={answers.schoolExperience}
                onValueChange={(value: string) => setAnswers({ ...answers, schoolExperience: value })}
              >
                <div className="space-y-3">
                  {[
                    { value: 'beginner', label: 'Just starting out', desc: "I've mostly used Scratch or block-based coding" },
                    { value: 'cff', label: "Completed 'Code For Fun' (CFF)", desc: "I've done the 10-hour MOE primary/secondary workshop" },
                    { value: 'computing', label: 'Taking/Took Upper Sec Computing', desc: "I'm familiar with the O-Level/G3 7155 Syllabus" },
                    { value: 'self-taught', label: 'Self-taught / Enrichment Hero', desc: 'I take external classes or learn on my own' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="cursor-pointer font-medium">
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

          {/* Step 3: Python Skills Level */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">Which Python level have you cleared?</h2>
                <p className="text-gray-600">Pick the highest level you're comfortable with</p>
              </div>

              <RadioGroup
                value={answers.pythonLevel}
                onValueChange={(value: string) => setAnswers({ ...answers, pythonLevel: value })}
              >
                <div className="space-y-3">
                  {[
                    { value: 'level-1', label: 'Level 1: Basics', desc: 'I can use print(), variables, and input() to talk to the user' },
                    { value: 'level-2', label: 'Level 2: Conditions', desc: "I'm comfortable with if-elif-else and comparison operators like == or >" },
                    { value: 'level-3', label: 'Level 3: Loops', desc: 'I can use for and while loops to make things happen multiple times' },
                    { value: 'level-4', label: 'Level 4: Functions & Data', desc: 'I can write my own def functions() and work with lists or dictionaries' },
                    { value: 'level-5', label: 'Level 5: Advanced', desc: 'I can import libraries, handle try/except errors, and read/write files' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="cursor-pointer font-medium">
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

          {/* Step 4: Biggest Challenges (Multi-select) */}
          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">When you start a project, what are your biggest challenges?</h2>
                <p className="text-gray-600">Select all that apply</p>
              </div>

              <div className="space-y-3">
                {[
                  { value: 'syntax', label: "I don't know the words", desc: 'I know what I want to do, but I forget the Python syntax/commands' },
                  { value: 'planning', label: "I don't know the steps", desc: 'I know Python, but I struggle to break a big problem into small steps' },
                  { value: 'debugging', label: 'I get stuck on bugs', desc: 'I can write code, but I struggle to find and fix errors when they happen' },
                  { value: 'advanced', label: 'I want to do more', desc: "I'm bored with the basics; I want to learn better ways to structure my code" },
                ].map((option) => {
                  const isChecked = answers.biggestChallenges?.includes(option.value) ?? false;
                  return (
                    <label
                      key={option.value}
                      className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        isChecked ? 'border-[#7622e5] bg-purple-50' : 'border-gray-200 hover:border-[#7622e5]'
                      }`}
                    >
                      <Checkbox
                        id={`challenge-${option.value}`}
                        checked={isChecked}
                        onCheckedChange={() => toggleChallenge(option.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label htmlFor={`challenge-${option.value}`} className="cursor-pointer font-medium">
                          {option.label}
                        </Label>
                        <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 5: Learning Mode / Guidance Preference */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl mb-2">How do you like to learn?</h2>
                <p className="text-gray-600">This controls how detailed our guidance will be</p>
              </div>

              <RadioGroup
                value={answers.learningMode}
                onValueChange={(value: string) => setAnswers({ ...answers, learningMode: value })}
              >
                <div className="space-y-3">
                  {[
                    { value: 'guided', label: 'Hold my hand', desc: 'Detailed instructions for every single line of code' },
                    { value: 'roadmap', label: 'Give me the roadmap', desc: "High-level steps, I'll figure out the syntax myself" },
                    { value: 'challenge', label: 'Challenge me', desc: "Just tell me the logic, I'll write the code and ask for hints only when stuck" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                    >
                      <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor={option.value} className="cursor-pointer font-medium">
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
              disabled={step === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <Button
              onClick={handleNext}
              disabled={!isStepComplete() || loading}
              className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
            >
              {(step === 0 && role === 'teacher') || step === 5
                ? (loading ? 'Saving...' : 'Complete')
                : 'Next'}
              {!((step === 0 && role === 'teacher') || step === 5) && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
