import { Question } from '../types';

export async function generateQuestions(subject: string, count: number = 5): Promise<Question[]> {
  try {
    console.log(`[Service] Attempting to generate ${count} questions for subject: ${subject}`);
    
    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subject, count }),
    });

    console.log(`[Service] API Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Service] Failed to generate questions:', {
        status: response.status,
        statusText: response.statusText,
        errorData
      });

      // If it's an API key error, don't fall back to default questions
      if (errorData.details?.code === 'invalid_api_key') {
        throw new Error('OpenAI API key is invalid. Please check your configuration.');
      }

      // For other errors, try to use the error message from the API
      throw new Error(errorData.details?.message || `Failed to generate questions: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Service] Received response data:', {
      hasQuestions: !!data.questions,
      questionCount: data.questions?.length
    });

    if (!data.questions || !Array.isArray(data.questions)) {
      console.error('[Service] Invalid response format:', data);
      throw new Error('Invalid response format from question generation');
    }

    console.log(`[Service] Successfully generated ${data.questions.length} questions`);
    return data.questions;
  } catch (error) {
    console.error('[Service] Error in generateQuestions:', error);
    
    // Only fall back to default questions for non-API key errors
    if (error instanceof Error && error.message.includes('API key')) {
      throw error; // Re-throw API key errors
    }
    
    console.log('[Service] Falling back to default questions');
    return generateFallbackQuestions(subject, count);
  }
}

function generateFallbackQuestions(subject: string, count: number): Question[] {
  console.log(`[Service] Generating ${count} fallback questions for subject: ${subject}`);
  
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