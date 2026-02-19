export const GUIDING_QUESTIONS = [
  {
    key: 'startPath',
    text: "How would you like to start?",
    options: [
      {
        id: 'have_idea',
        label: 'I have a project idea',
        value: 'have_idea',
        desc: 'You already know what you want to build.'
      },
      {
        id: 'learn_concept',
        label: 'I want to learn a concept',
        value: 'learn_concept',
        desc: "Pick a Python topic and we'll find a project for it."
      },
      {
        id: 'surprise',
        label: 'Surprise me!',
        value: 'surprise',
        desc: "We'll suggest something fun based on your level."
      }
    ]
  },
  {
    key: 'description',
    text: "Tell us a bit more!",
    inputType: 'text',
    placeholder: "e.g., a quiz game, expense tracker, or a topic like loops, file handling, classes..."
  },
  {
    key: 'timeline',
    text: "How much time do you want to invest?",
    options: [
      {
        id: 'quick_start',
        label: '30–60 minutes',
        value: '30-60 min quick start',
        desc: 'A quick, focused mini-project.'
      },
      {
        id: 'mini_project',
        label: '1–2 hours',
        value: '1-2 hours mini project',
        desc: 'A small but complete project.'
      },
      {
        id: 'standard',
        label: '3–5 hours',
        value: '3-5 hours standard build',
        desc: 'A more detailed project with extra features.'
      },
      {
        id: 'weekend',
        label: '1 weekend (6–12 hours)',
        value: '6-12 hours weekend build',
        desc: 'A full project with multiple features.'
      }
    ]
  }
];
