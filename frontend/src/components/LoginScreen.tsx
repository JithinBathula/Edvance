// import { useState } from 'react';
// import { User } from '../App';
// import { projectId, publicAnonKey } from '../utils/supabase/info';
// import { Button } from './ui/button';
// import { Input } from './ui/input';
// import { Code2 } from 'lucide-react';
// import React from 'react';

// type Props = {
//   onLogin: (user: User) => void;
// };

// export function LoginScreen({ onLogin }: Props) {
//   const [name, setName] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
    
//     if (!name.trim()) {
//       setError('Please enter your name');
//       return;
//     }

//     setLoading(true);
//     setError('');

//     try {
//       // Check if user exists
//       const checkResponse = await fetch(
//         `https://${projectId}.supabase.co/functions/v1/server/user/${encodeURIComponent(name)}`,
//         {
//           headers: {
//             Authorization: `Bearer ${publicAnonKey}`,
//           },
//         }
//       );

//       const checkData = await checkResponse.json();

//       if (checkData.exists && checkData.user) {
//         onLogin(checkData.user);
//       } else {
//         // Create new user
//         const createResponse = await fetch(
//           `https://${projectId}.supabase.co/functions/v1/server/user`,
//           {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json',
//               Authorization: `Bearer ${publicAnonKey}`,
//             },
//             body: JSON.stringify({ name }),
//           }
//         );

//         const createData = await createResponse.json();
        
//         if (createData.success && createData.user) {
//           onLogin(createData.user);
//         } else {
//           setError('Failed to create account');
//         }
//       }
//     } catch (err) {
//       console.error('Login error:', err);
//       setError('An error occurred. Please try again.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-orange-50 p-4">
//       <div className="w-full max-w-md">
//         <div className="text-center mb-8">
//           <div className="flex justify-center mb-4">
//             <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
//               <Code2 className="w-8 h-8 text-white" />
//             </div>
//           </div>
//           <h1 className="text-4xl mb-2 bg-gradient-to-r from-[#7622e5] to-[#ffa200] bg-clip-text text-transparent">
//             Edvance
//           </h1>
//           <p className="text-gray-600">
//             Learn coding by building real projects
//           </p>
//         </div>

//         <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
//           <h2 className="text-2xl mb-6 text-center">Welcome!</h2>
          
//           <form onSubmit={handleSubmit} className="space-y-6">
//             <div>
//               <label htmlFor="name" className="block text-sm mb-2 text-gray-700">
//                 What's your name?
//               </label>
//               <Input
//                 id="name"
//                 type="text"
//                 value={name}
//                 onChange={(e) => setName(e.target.value)}
//                 placeholder="Enter your name"
//                 className="w-full"
//                 disabled={loading}
//               />
//             </div>

//             {error && (
//               <p className="text-sm text-red-600">{error}</p>
//             )}

//             <Button
//               type="submit"
//               disabled={loading}
//               className="w-full bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
//             >
//               {loading ? 'Loading...' : 'Get Started'}
//             </Button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }
import { useState } from 'react';
import { User } from '../App';
// NOTE: projectId and publicAnonKey are no longer needed for this temporary login flow
// import { projectId, publicAnonKey } from '../utils/supabase/info'; 
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Code2 } from 'lucide-react';
import React from 'react';

type Props = {
  onLogin: (user: User) => void;
};

// Function to generate a new, temporary UUID
const generateTemporaryUserId = (): string => {
  // Use the built-in browser Web Crypto API for a high-quality UUID (v4)
  // This is the standard way to generate temporary unique IDs in a browser environment.
  return crypto.randomUUID();
};

export function LoginScreen({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    // --- START OF REVISED LOGIC ---

    // 1. Check if a temporary ID already exists in local storage
    let tempUserId = localStorage.getItem('temp_user_id');

    // 2. If no ID exists, generate a new one
    if (!tempUserId) {
      tempUserId = generateTemporaryUserId();
      localStorage.setItem('temp_user_id', tempUserId);
    }

    // 3. Create a mock User object using the generated/retrieved ID and the entered name
    const mockUser: User = {
      id: tempUserId,
      name: name.trim(),
      
      // Add placeholder values for the missing properties:
      onboarding: null, // Assuming a default value
      createdAt: new Date().toISOString(), // Use current timestamp
      xp: 0, // Starting XP
      completedProjects: [], // Empty array of projects
    };
    
    // 4. Simulate a successful login by calling onLogin with the mock user
    onLogin(mockUser);
    
    // --- END OF REVISED LOGIC ---
    
    // NOTE: We don't need a try/catch or setLoading(false) here because the login 
    // is synchronous and client-side, but we keep setLoading(false) for good measure 
    // or if the onLogin function were to be complex.

    setLoading(false);
  };

  return (
    // ... (rest of your component rendering remains the same)
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-orange-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#7622e5] to-[#b480f8] flex items-center justify-center">
              <Code2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl mb-2 bg-gradient-to-r from-[#7622e5] to-[#ffa200] bg-clip-text text-transparent">
            Edvance
          </h1>
          <p className="text-gray-600">
            Learn coding by building real projects
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl mb-6 text-center">Welcome!</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm mb-2 text-gray-700">
                What's your name?
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full"
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#7622e5] to-[#b480f8] hover:from-[#6518d0] hover:to-[#a070e8]"
            >
              {loading ? 'Loading...' : 'Get Started'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}