export const GUIDING_QUESTIONS = [  {
    key: 'projectType',
    text: "What kind of project do you want to build? (Select all that apply)",
    multiSelect: true, 
    options: [
      { 
        id: 'website', 
        label: 'Website', 
        value: 'website',
        desc: 'A site on the internet that people can visit.' 
      },
      { 
        id: 'game', 
        label: 'Game', 
        value: 'game',
        desc: 'Something fun to play (like Pong or a Quiz).' 
      },
      { 
        id: 'tool', 
        label: 'Tool', 
        value: 'tool',
        desc: 'A utility to help you calculate, track, or automate tasks.' 
      },
      { 
        id: 'ai', 
        label: 'AI', 
        value: 'ai',
        desc: 'A smart program that uses Artificial Intelligence.' 
      }
    ]
  },
  {
    key: 'projectIdea',
    text: "What is the project idea you have in mind?",
    inputType: 'text',
    placeholder: "Describe your project idea e.g., Finance tracker, Tic tac toe game..."
  },
  {
    key: 'mainFeatures',
    text: "What are the must-have features for your project?",
    inputType: 'text',
    placeholder: "e.g., Authentication, Chatbot, Dashboard..."
  },
  {
    key: 'objective',
    text: "What do you want to achieve with this project?",
    inputType: 'text',
    placeholder: "What problem or opportunity are you addressing?"
  },
  {
  key: 'timeline',
  text: "How much time do you want to invest in this project?",
  options: [
    { 
      id: 'quick_start',
      label: '30–60 minutes',
      value: '30-60 min quick start',
      desc: 'Quick win: one simple feature, very light UI.'
    },
    { 
      id: 'mini_project', 
      label: '1–2 hours', 
      value: '1-2 hours mini project',
      desc: 'Mini project: one core feature, minimal polish.'
    },
    { 
      id: 'standard', 
      label: '3–5 hours', 
      value: '3-5 hours standard build',
      desc: 'Standard build: core feature + basic UI + a few edge cases.'
    },
    { 
      id: 'weekend', 
      label: '1 weekend (6–12 hours)', 
      value: '6-12 hours weekend build',
      desc: 'Solid build: a few features, nicer UI, and basic testing/debugging.'
    }
  ]
}
];