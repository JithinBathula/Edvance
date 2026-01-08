import { useState } from 'react';
import { User, OnboardingData } from '../App';
import { BACKEND_URL } from '../utils/constants';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import { ArrowLeft, Save, User as UserIcon, Target, Code2, Palette } from 'lucide-react';

type Props = {
  user: User;
  onUpdate: (data: OnboardingData) => void;
  onBack: () => void;
};

export function ProfilePage({ user, onUpdate, onBack }: Props) {
  const [loading, setLoading] = useState(false);

  const [answers, setAnswers] = useState<OnboardingData>(
    {
      pythonExperience: user.onboarding?.pythonExperience || '',
      experienceLevel: user.onboarding?.experienceLevel || '',
      goal: user.onboarding?.goal || '',
      theme: user.onboarding?.theme || '',
    }
  );

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

  const getThemeIcon = (theme: string) => {
    switch (theme) {
      case 'chatbot':
        return '🤖';
      case 'gaming':
        return '🎮';
      case 'finance':
        return '💰';
      default:
        return '✨';
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
          {/* Python Experience */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Code2 className="w-5 h-5 text-[#7622e5]" />
              </div>
              <div>
                <h3 className="text-xl">Python Experience</h3>
                <p className="text-sm text-gray-600">How long have you been coding in Python?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.pythonExperience}
              onValueChange={(value: string) => setAnswers({ ...answers, pythonExperience: value })}
            >
              <div className="grid grid-cols-2 gap-3">
                {['Just starting out', '1-3 months', '3-6 months', '6+ months'].map((option) => (
                  <label
                    key={option}
                    className="flex items-center space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#7622e5] cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option} id={`exp-${option}`} />
                    <Label htmlFor={`exp-${option}`} className="cursor-pointer">
                      {option}
                    </Label>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          {/* Experience Level */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#ffa200]" />
              </div>
              <div>
                <h3 className="text-xl">Experience Level</h3>
                <p className="text-sm text-gray-600">What's your current skill level?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.experienceLevel}
              onValueChange={(value: string) => setAnswers({ ...answers, experienceLevel: value })}
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
                    className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#ffa200] cursor-pointer transition-colors"
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

          {/* Goal */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-[#7622e5]" />
              </div>
              <div>
                <h3 className="text-xl">Learning Goal</h3>
                <p className="text-sm text-gray-600">What brings you to Edvance?</p>
              </div>
            </div>

            <RadioGroup
              value={answers.goal}
              onValueChange={(value: string) => setAnswers({ ...answers, goal: value })}
            >
              <div className="grid grid-cols-2 gap-3">
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
                    <RadioGroupItem value={option} id={`goal-${option}`} />
                    <Label htmlFor={`goal-${option}`} className="cursor-pointer">
                      {option}
                    </Label>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </Card>

          {/* Theme */}
          <Card className="p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Palette className="w-5 h-5 text-[#ffa200]" />
              </div>
              <div>
                <h3 className="text-xl">Learning Theme</h3>
                <p className="text-sm text-gray-600">Choose your preferred project theme</p>
              </div>
            </div>

            <RadioGroup
              value={answers.theme}
              onValueChange={(value: string) => setAnswers({ ...answers, theme: value })}
            >
              <div className="space-y-3">
                {[
                  { value: 'chatbot', label: '🤖 Chatbots & AI', desc: 'Build conversational AI and intelligent bots' },
                  { value: 'gaming', label: '🎮 Gaming', desc: 'Create fun games and interactive experiences' },
                  { value: 'finance', label: '💰 Finance & Budgeting', desc: 'Develop budget trackers and financial tools' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 p-4 rounded-lg border-2 border-gray-200 hover:border-[#ffa200] cursor-pointer transition-colors"
                  >
                    <RadioGroupItem value={option.value} id={`theme-${option.value}`} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={`theme-${option.value}`} className="cursor-pointer">
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
