import { Question } from '../types';

export async function generateQuestions(subject: string, count: number = 5): Promise<Question[]> {
  try {
    console.log(`Attempting to generate ${count} questions for subject: ${subject}`);
    
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, count }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to generate questions:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });
      throw new Error(`Failed to generate questions: ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.questions || !Array.isArray(data.questions)) {
      console.error('Invalid response format:', data);
      throw new Error('Invalid response format from question generation');
    }

    console.log(`Successfully generated ${data.questions.length} questions`);
    return data.questions;
  } catch (error) {
    console.error('Error in generateQuestions:', error);
    console.log('Falling back to default questions');
    return generateFallbackQuestions(subject, count);
  }
}

function generateFallbackQuestions(subject: string, count: number): Question[] {
  console.log(`Generating ${count} fallback questions for subject: ${subject}`);
  
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