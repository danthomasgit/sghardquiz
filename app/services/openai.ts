import { Question } from '../types';

export async function generateQuestions(subject: string, count: number = 5): Promise<Question[]> {
  try {
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, count }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate questions');
    }

    const data = await response.json();
    return data.questions;
  } catch (error) {
    console.error('Error generating questions:', error);
    return generateFallbackQuestions(subject, count);
  }
}

function generateFallbackQuestions(subject: string, count: number): Question[] {
  const fallbackQuestions: Question[] = [
    {
      question: `What is a key concept in ${subject}?`,
      answer: 'This is a fallback question'
    },
    {
      question: `Name a famous figure in ${subject}`,
      answer: 'This is a fallback question'
    },
    {
      question: `What is an important event in ${subject}?`,
      answer: 'This is a fallback question'
    }
  ];

  // Repeat questions if needed to reach the requested count
  while (fallbackQuestions.length < count) {
    fallbackQuestions.push(fallbackQuestions[0]);
  }

  return fallbackQuestions.slice(0, count);
} 