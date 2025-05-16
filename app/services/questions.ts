import { Question } from '../types';

const OPEN_TRIVIA_API = 'https://opentdb.com/api.php';

export async function generateQuestions(subject: string, count: number = 5): Promise<Question[]> {
  try {
    // Map common subjects to Open Trivia categories with more specific mappings
    const categoryMap: { [key: string]: number } = {
      // Science categories
      'physics': 17,
      'chemistry': 17,
      'biology': 17,
      'astronomy': 17,
      'science': 17,
      
      // History categories
      'ancient history': 23,
      'modern history': 23,
      'world history': 23,
      'history': 23,
      
      // Geography categories
      'geography': 22,
      'countries': 22,
      'capitals': 22,
      'landmarks': 22,
      
      // Entertainment categories
      'movies': 11,
      'film': 11,
      'cinema': 11,
      'television': 14,
      'tv': 14,
      'music': 12,
      'books': 10,
      'literature': 10,
      'art': 25,
      'painting': 25,
      'sculpture': 25,
      
      // Sports categories
      'sports': 21,
      'football': 21,
      'basketball': 21,
      'baseball': 21,
      'soccer': 21,
      
      // Other categories
      'politics': 24,
      'mythology': 20,
      'animals': 27,
      'video games': 15,
      'gaming': 15
    };

    // Find the closest matching category
    const normalizedSubject = subject.toLowerCase();
    let categoryId = 9; // General Knowledge as default
    let bestMatch = '';
    
    // Find the best matching category
    for (const [key, id] of Object.entries(categoryMap)) {
      if (normalizedSubject.includes(key) && key.length > bestMatch.length) {
        categoryId = id;
        bestMatch = key;
      }
    }

    // Fetch more questions than needed to filter for difficulty
    const response = await fetch(
      `${OPEN_TRIVIA_API}?amount=${count * 3}&category=${categoryId}&type=multiple`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch questions');
    }

    const data = await response.json();

    if (data.response_code !== 0) {
      throw new Error('Invalid response from trivia API');
    }

    // Filter for medium and hard questions, and ensure they're relevant to the subject
    const filteredQuestions = data.results
      .filter((q: any) => q.difficulty === 'medium' || q.difficulty === 'hard')
      .filter((q: any) => {
        const questionText = q.question.toLowerCase();
        const answerText = q.correct_answer.toLowerCase();
        return questionText.includes(bestMatch) || answerText.includes(bestMatch);
      })
      .map((q: any) => ({
        question: decodeHTML(q.question),
        answer: decodeHTML(q.correct_answer),
        difficulty: q.difficulty
      }));

    // If we don't have enough questions after filtering, generate fallback questions
    if (filteredQuestions.length < count) {
      const fallbackQuestions = generateFallbackQuestions(subject, count - filteredQuestions.length);
      return [...filteredQuestions, ...fallbackQuestions];
    }

    return filteredQuestions.slice(0, count);
  } catch (error) {
    console.error('Error generating questions:', error);
    return generateFallbackQuestions(subject, count);
  }
}

function decodeHTML(html: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
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