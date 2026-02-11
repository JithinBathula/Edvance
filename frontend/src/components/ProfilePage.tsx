import { useState, useRef } from 'react';
import { User, OnboardingData } from '../App';
import { authFetch } from '../utils/authFetch';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { ArrowLeft, Save, User as UserIcon, GraduationCap, Code2, Target, Lightbulb, BookOpen, Camera } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  user: User;
  onUpdate: (data: OnboardingData) => void;
  onProfilePictureUpdate?: (profilePictureUrl: string) => void;
  onBack: () => void;
};

export function ProfilePage({ user, onUpdate, onProfilePictureUpdate, onBack }: Props) {
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profilePicture, setProfilePicture] = useState(user.profilePictureUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleImageUpload triggered');
    const file = event.target.files?.[0];
    console.log('Selected file:', file);
    if (!file) {
      console.log('No file selected');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB');
      return;
    }

    setUploadingImage(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;

        try {
          const response = await authFetch('/users/profile-picture', {
            method: 'POST',
            body: JSON.stringify({ image: base64Image }),
          });

          const data = await response.json();

          console.log('Upload response:', data);
          console.log('Profile picture URL:', data.profile_picture_url);

          if (data.success) {
            setProfilePicture(data.profile_picture_url);

            // Update parent component's user state
            if (onProfilePictureUpdate) {
              onProfilePictureUpdate(data.profile_picture_url);
            }

            console.log('Profile picture updated:', data.profile_picture_url);

            toast.success('Profile picture updated!');
          } else {
            toast.error(data.error || 'Failed to upload image');
          }
        } catch (err) {
          console.error('Upload error:', err);
          toast.error('Failed to upload image');
        } finally {
          setUploadingImage(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      toast.error('Failed to read image file');
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const response = await authFetch('/users/onboarding', {
        method: 'POST',
        body: JSON.stringify({
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
            <div className="relative group">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div
                onClick={() => {
                  console.log('Avatar clicked, opening file picker...');
                  console.log('File input ref:', fileInputRef.current);
                  fileInputRef.current?.click();
                }}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center cursor-pointer relative overflow-hidden"
              >
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-8 h-8 text-white" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
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
