import { useState } from 'react';
import { User, OnboardingData } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ArrowLeft, Save, User as UserIcon, GraduationCap, Code2, Target, Lightbulb, BookOpen } from 'lucide-react';

type Props = {
  user: User;
  onUpdate: (data: OnboardingData) => void;
  onBack: () => void;
};

export function ProfilePage({ user, onUpdate, onBack }: Props) {
  const [loading, setLoading] = useState(false);

  const [answers, setAnswers] = useState<OnboardingData>({
    educationLevel: user.onboarding?.educationLevel || '',
    schoolExperience: user.onboarding?.schoolExperience || '',
    pythonLevel: user.onboarding?.pythonLevel || '',
    biggestChallenges: user.onboarding?.biggestChallenges || [],
    learningMode: user.onboarding?.learningMode || '',
  });

  const toggleChallenge = (value: string) => {
    const current = answers.biggestChallenges || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setAnswers({ ...answers, biggestChallenges: updated });
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/users/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          onboardingData: answers,
        }),
      });

      const data = await response.json();

      if (data.success) {
        onUpdate(answers);
      }
    } catch (err) {
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-orange-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl">Your Profile</h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* User Info Card */}
        <Card className="p-6 mb-8 bg-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl mb-1">{user.name}</h2>
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#ffa200] to-[#ff8800] text-white text-sm">
                  {user.xp} XP
                </div>
                <span className="text-sm text-gray-600">
                  {user.completedProjects?.length || 0} projects completed
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Learning Preferences */}
        <div className="space-y-6">
          {/* Education Level */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#7622e5]" />
              </div>
              <div>
                <h3 className="text-xl">Education Level</h3>
                <p className="text-sm text-gray-600">What is your current level?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.educationLevel}
              onValueChange={(value: string) => setAnswers({ ...answers, educationLevel: value })}
            >
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'primary', label: 'Primary 5 / Primary 6' },
                  { value: 'lower-sec', label: 'Lower Secondary (Sec 1-2)' },
                  { value: 'upper-sec', label: 'Upper Secondary (Sec 3-5)' },
                  { value: 'post-sec', label: 'JC / MI / Poly / ITE' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option.value} id={`edu-${option.value}`} />
                    <Label htmlFor={`edu-${option.value}`} className="cursor-pointer">
                      {option.label}
                    </Label>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          {/* School Experience */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#ffa200]" />
              </div>
              <div>
                <h3 className="text-xl">School Coding Experience</h3>
                <p className="text-sm text-gray-600">What's the most advanced coding you've done in school?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.schoolExperience}
              onValueChange={(value: string) => setAnswers({ ...answers, schoolExperience: value })}
            >
              <div className="space-y-3">
                {[
                  { value: 'beginner', label: 'Just starting out', desc: "I've mostly used Scratch or block-based coding" },
                  { value: 'cff', label: "Completed 'Code For Fun' (CFF)", desc: "I've done the 10-hour MOE workshop" },
                  { value: 'computing', label: 'Taking/Took Upper Sec Computing', desc: "Familiar with O-Level/G3 7155 Syllabus" },
                  { value: 'self-taught', label: 'Self-taught / Enrichment Hero', desc: 'External classes or self-learning' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#ffa200] cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option.value} id={`school-${option.value}`} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={`school-${option.value}`} className="cursor-pointer">
                        {option.label}
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          {/* Python Level */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-[#7622e5]" />
              </div>
              <div>
                <h3 className="text-xl">Python Level</h3>
                <p className="text-sm text-gray-600">Which level have you cleared?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.pythonLevel}
              onValueChange={(value: string) => setAnswers({ ...answers, pythonLevel: value })}
            >
              <div className="space-y-3">
                {[
                  { value: 'level-1', label: 'Level 1: Basics', desc: 'print(), variables, and input()' },
                  { value: 'level-2', label: 'Level 2: Conditions', desc: 'if-elif-else and comparison operators' },
                  { value: 'level-3', label: 'Level 3: Loops', desc: 'for and while loops' },
                  { value: 'level-4', label: 'Level 4: Functions & Data', desc: 'def functions, lists, dictionaries' },
                  { value: 'level-5', label: 'Level 5: Advanced', desc: 'Libraries, try/except, file I/O' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option.value} id={`level-${option.value}`} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={`level-${option.value}`} className="cursor-pointer">
                        {option.label}
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          {/* Biggest Challenges (Multi-select) */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#ffa200]" />
              </div>
              <div>
                <h3 className="text-xl">Biggest Challenges</h3>
                <p className="text-sm text-gray-600">Select all that apply</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'syntax', label: "I don't know the words", desc: 'Forget Python syntax' },
                { value: 'planning', label: "I don't know the steps", desc: 'Struggle to break down problems' },
                { value: 'debugging', label: 'I get stuck on bugs', desc: 'Hard to find and fix errors' },
                { value: 'advanced', label: 'I want to do more', desc: 'Ready for advanced patterns' },
              ].map((option) => {
                const isChecked = answers.biggestChallenges?.includes(option.value) ?? false;
                return (
                  <label
                    key={option.value}
                    className={`flex items-start space-x-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isChecked ? 'border-[#ffa200] bg-orange-50' : 'border-gray-200 hover:border-[#ffa200]'
                    }`}
                  >
                    <Checkbox
                      id={`challenge-${option.value}`}
                      checked={isChecked}
                      onCheckedChange={() => toggleChallenge(option.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <Label htmlFor={`challenge-${option.value}`} className="cursor-pointer text-sm">
                        {option.label}
                      </Label>
                      <p className="text-xs text-gray-500 mt-1">{option.desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </Card>

          {/* Learning Mode */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-[#7622e5]" />
              </div>
              <div>
                <h3 className="text-xl">Learning Mode</h3>
                <p className="text-sm text-gray-600">How do you like to learn?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.learningMode}
              onValueChange={(value: string) => setAnswers({ ...answers, learningMode: value })}
            >
              <div className="space-y-3">
                {[
                  { value: 'guided', label: 'Hold my hand', desc: 'Detailed instructions for every line of code' },
                  { value: 'roadmap', label: 'Give me the roadmap', desc: "High-level steps, I'll figure out the syntax" },
                  { value: 'challenge', label: 'Challenge me', desc: 'Just the logic, I\'ll ask for hints when stuck' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option.value} id={`mode-${option.value}`} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={`mode-${option.value}`} className="cursor-pointer">
                        {option.label}
                      </Label>
                      <p className="text-sm text-gray-500 mt-1">{option.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>
        </div>
      </div>
    </div>
  );
}
