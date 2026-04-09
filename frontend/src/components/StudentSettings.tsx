import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Save,
  Trash2,
  Lock,
  User as UserIcon,
  Shield,
  Camera,
  GraduationCap,
  Code2,
  Target,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { authFetch } from '../utils/authFetch';
import { supabase } from '../utils/supabase/client';
import { User, OnboardingData } from '../App';

interface StudentSettingsPanelProps {
  user: User;
  onLogout: () => void;
  onProfilePictureUpdate?: (url: string) => void;
  onProfileUpdate?: (data: OnboardingData) => void;
}

const WORKSPACE_TOUR_STORAGE_KEY = 'edvance_workspace_tour_completed';
const DASHBOARD_TOUR_STORAGE_KEY = 'edvance_student_dashboard_tour_completed';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.4 } }),
};

export function StudentSettingsPanel({ user, onLogout, onProfilePictureUpdate, onProfileUpdate }: StudentSettingsPanelProps) {
  const [name, setName] = useState(user.name);
  const [savingProfile, setSavingProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Profile picture
  const [profilePicture, setProfilePicture] = useState(user.profilePictureUrl || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Learning preferences
  const [answers, setAnswers] = useState<OnboardingData>({
    educationLevel: user.onboarding?.educationLevel || '',
    schoolExperience: user.onboarding?.schoolExperience || '',
    pythonLevel: user.onboarding?.pythonLevel || '',
    biggestChallenges: user.onboarding?.biggestChallenges || [],
    learningMode: user.onboarding?.learningMode || '',
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  const toggleChallenge = (value: string) => {
    const current = answers.biggestChallenges || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setAnswers({ ...answers, biggestChallenges: updated });
  };

  const handleSaveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error('Name cannot be empty'); return; }
    try {
      setSavingProfile(true);
      const response = await authFetch('/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await response.json();
      if (data.success) toast.success('Profile updated');
      else toast.error(data.error || 'Failed to update profile');
    } catch { toast.error('Failed to update profile'); }
    finally { setSavingProfile(false); }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be smaller than 5MB'); return; }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target?.result as string;
        try {
          const response = await authFetch('/users/profile-picture', {
            method: 'POST',
            body: JSON.stringify({ image: base64Image }),
          });
          const data = await response.json();
          if (data.success) {
            setProfilePicture(data.profile_picture_url);
            onProfilePictureUpdate?.(data.profile_picture_url);
            toast.success('Profile picture updated!');
          } else {
            toast.error(data.error || 'Failed to upload image');
          }
        } catch { toast.error('Failed to upload image'); }
        finally { setUploadingImage(false); }
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Failed to read image file');
      setUploadingImage(false);
    }
  };

  const handleSavePreferences = async () => {
    setSavingPreferences(true);
    try {
      const onboardingData = {
        ...(user.onboarding || {}),
        ...answers,
        ...(localStorage.getItem(WORKSPACE_TOUR_STORAGE_KEY) === 'true'
          ? { workspace_tour_completed: true }
          : {}),
        ...(localStorage.getItem(DASHBOARD_TOUR_STORAGE_KEY) === 'true'
          ? { student_dashboard_tour_completed: true }
          : {}),
      };
      const response = await authFetch('/users/onboarding', {
        method: 'POST',
        body: JSON.stringify({ onboardingData }),
      });
      const data = await response.json();
      if (data.success) {
        onProfileUpdate?.(onboardingData);
        toast.success('Learning preferences saved');
      } else {
        toast.error(data.error || 'Failed to save preferences');
      }
    } catch { toast.error('Failed to save preferences'); }
    finally { setSavingPreferences(false); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) toast.error(error.message || 'Failed to change password');
      else { toast.success('Password changed successfully'); setNewPassword(''); setConfirmPassword(''); }
    } catch { toast.error('Failed to change password'); }
    finally { setChangingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleting(true);
      const response = await authFetch('/users/account', { method: 'DELETE' });
      const data = await response.json();
      if (data.success) { toast.success('Account deleted'); setDeleteDialogOpen(false); onLogout(); }
      else toast.error(data.error || 'Failed to delete account');
    } catch { toast.error('Failed to delete account'); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <div className="w-full">
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="mt-1 text-sm text-slate-500">Manage your profile, preferences, and account</p>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
          <Tabs defaultValue="profile">
            <TabsList className="mb-6">
              <TabsTrigger value="profile"><UserIcon className="mr-1.5 h-4 w-4" />Profile</TabsTrigger>
              <TabsTrigger value="preferences"><BookOpen className="mr-1.5 h-4 w-4" />Preferences</TabsTrigger>
              <TabsTrigger value="account"><Shield className="mr-1.5 h-4 w-4" />Account</TabsTrigger>
            </TabsList>

            {/* ── Profile Tab ── */}
            <TabsContent value="profile">
              <Card>
                <CardHeader><CardTitle>Profile Information</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {/* Profile Picture */}
                  <div className="flex items-center gap-4">
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center cursor-pointer relative overflow-hidden group"
                    >
                      {profilePicture ? (
                        <img src={profilePicture} alt={user.name} className="w-full h-full object-cover" />
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
                    <div>
                      <p className="text-sm font-medium text-slate-700">Profile Picture</p>
                      <p className="text-xs text-slate-400">Click to upload (max 5MB)</p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                    <Input value={user.email || ''} disabled className="bg-slate-50 text-slate-500" />
                    <p className="mt-1 text-xs text-slate-400">Email is managed by your login provider and cannot be changed here.</p>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={savingProfile || name.trim() === user.name} className="bg-teal-600 hover:bg-teal-700">
                    <Save className="mr-2 h-4 w-4" />{savingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Preferences Tab ── */}
            <TabsContent value="preferences">
              <div className="space-y-6">
                {/* Education Level */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                      <GraduationCap className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Education Level</h3>
                      <p className="text-sm text-slate-500">What is your current level?</p>
                    </div>
                  </div>
                  <RadioGroup value={answers.educationLevel} onValueChange={(value: string) => setAnswers({ ...answers, educationLevel: value })}>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'primary', label: 'Primary 5 / Primary 6' },
                        { value: 'lower-sec', label: 'Lower Secondary (Sec 1-2)' },
                        { value: 'upper-sec', label: 'Upper Secondary (Sec 3-5)' },
                        { value: 'post-sec', label: 'JC / MI / Poly / ITE' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border-2 border-slate-200 hover:border-teal-400 cursor-pointer transition-colors">
                          <RadioGroupItem value={option.value} id={`edu-${option.value}`} />
                          <Label htmlFor={`edu-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </Card>

                {/* School Experience */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">School Coding Experience</h3>
                      <p className="text-sm text-slate-500">What's the most advanced coding you've done in school?</p>
                    </div>
                  </div>
                  <RadioGroup value={answers.schoolExperience} onValueChange={(value: string) => setAnswers({ ...answers, schoolExperience: value })}>
                    <div className="space-y-3">
                      {[
                        { value: 'beginner', label: 'Just starting out', desc: "I've mostly used Scratch or block-based coding" },
                        { value: 'cff', label: "Completed 'Code For Fun' (CFF)", desc: "I've done the 10-hour MOE workshop" },
                        { value: 'computing', label: 'Taking/Took Upper Sec Computing', desc: "Familiar with O-Level/G3 7155 Syllabus" },
                        { value: 'self-taught', label: 'Self-taught / Enrichment Hero', desc: 'External classes or self-learning' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-start space-x-3 p-3 rounded-lg border-2 border-slate-200 hover:border-amber-400 cursor-pointer transition-colors">
                          <RadioGroupItem value={option.value} id={`school-${option.value}`} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={`school-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                            <p className="text-xs text-slate-500 mt-1">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </Card>

                {/* Python Level */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Code2 className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Python Level</h3>
                      <p className="text-sm text-slate-500">Which level have you cleared?</p>
                    </div>
                  </div>
                  <RadioGroup value={answers.pythonLevel} onValueChange={(value: string) => setAnswers({ ...answers, pythonLevel: value })}>
                    <div className="space-y-3">
                      {[
                        { value: 'level-1', label: 'Level 1: Basics', desc: 'print(), variables, and input()' },
                        { value: 'level-2', label: 'Level 2: Conditions', desc: 'if-elif-else and comparison operators' },
                        { value: 'level-3', label: 'Level 3: Loops', desc: 'for and while loops' },
                        { value: 'level-4', label: 'Level 4: Functions & Data', desc: 'def functions, lists, dictionaries' },
                        { value: 'level-5', label: 'Level 5: Advanced', desc: 'Libraries, try/except, file I/O' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-start space-x-3 p-3 rounded-lg border-2 border-slate-200 hover:border-teal-400 cursor-pointer transition-colors">
                          <RadioGroupItem value={option.value} id={`level-${option.value}`} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={`level-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                            <p className="text-xs text-slate-500 mt-1">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </Card>

                {/* Biggest Challenges */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Target className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Biggest Challenges</h3>
                      <p className="text-sm text-slate-500">Select all that apply</p>
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
                          className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                            isChecked ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-amber-400'
                          }`}
                        >
                          <Checkbox
                            id={`challenge-${option.value}`}
                            checked={isChecked}
                            onCheckedChange={() => toggleChallenge(option.value)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label htmlFor={`challenge-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                            <p className="text-xs text-slate-500 mt-1">{option.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </Card>

                {/* Learning Mode */}
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">Learning Mode</h3>
                      <p className="text-sm text-slate-500">How do you like to learn?</p>
                    </div>
                  </div>
                  <RadioGroup value={answers.learningMode} onValueChange={(value: string) => setAnswers({ ...answers, learningMode: value })}>
                    <div className="space-y-3">
                      {[
                        { value: 'guided', label: 'Hold my hand', desc: 'Detailed instructions for every line of code' },
                        { value: 'roadmap', label: 'Give me the roadmap', desc: "High-level steps, I'll figure out the syntax" },
                        { value: 'challenge', label: 'Challenge me', desc: 'Just the logic, I\'ll ask for hints when stuck' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-start space-x-3 p-3 rounded-lg border-2 border-slate-200 hover:border-teal-400 cursor-pointer transition-colors">
                          <RadioGroupItem value={option.value} id={`mode-${option.value}`} className="mt-1" />
                          <div className="flex-1">
                            <Label htmlFor={`mode-${option.value}`} className="cursor-pointer text-sm">{option.label}</Label>
                            <p className="text-xs text-slate-500 mt-1">{option.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </Card>

                <Button onClick={handleSavePreferences} disabled={savingPreferences} className="bg-teal-600 hover:bg-teal-700">
                  <Save className="mr-2 h-4 w-4" />{savingPreferences ? 'Saving...' : 'Save Preferences'}
                </Button>
              </div>
            </TabsContent>

            {/* ── Account Tab ── */}
            <TabsContent value="account">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />Change Password</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">New Password</label>
                      <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">Confirm Password</label>
                      <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" />
                    </div>
                    <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword} className="bg-teal-600 hover:bg-teal-700">
                      {changingPassword ? 'Changing...' : 'Update Password'}
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-red-200">
                  <CardContent>
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 mt-5" onClick={() => setDeleteDialogOpen(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />Delete My Account
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600">This will permanently delete your account and all your project data. You will be logged out and won't be able to recover this account.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeleteAccount} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
